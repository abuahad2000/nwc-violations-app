import os
import time
from contextlib import contextmanager
from typing import Any

import psycopg
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse
from starlette.background import BackgroundTask

from app.services.kmz_exporter import KMZExportError, generate_enterprise_kmz
from fastapi.middleware.cors import CORSMiddleware

DATABASE_URL = os.environ["DATABASE_URL"]

app = FastAPI(title="Nitaq Spatial API", version="1.0.0")
_metrics = {"requests_total": 0, "request_errors": 0, "request_seconds_total": 0.0}


@app.middleware("http")
async def request_metrics(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
        return response
    except Exception:
        _metrics["request_errors"] += 1
        raise
    finally:
        _metrics["requests_total"] += 1
        _metrics["request_seconds_total"] += time.perf_counter() - started
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@contextmanager
def connection():
    with psycopg.connect(DATABASE_URL) as conn:
        yield conn


@app.get("/health")
def health() -> dict[str, str]:
    with connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok", "service": "nitaq-spatial-api"}


@app.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
def metrics() -> str:
    return (
        f"nitaq_requests_total {_metrics['requests_total']}\n"
        f"nitaq_request_errors_total {_metrics['request_errors']}\n"
        f"nitaq_request_seconds_total {_metrics['request_seconds_total']:.6f}\n"
    )


@app.get("/api/test/health")
def test_health() -> dict[str, Any]:
    """Operational data health summary for local/integration verification."""
    with connection() as conn:
        counts = conn.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND service_type = 'WATER') AS water_projects,
              (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND service_type = 'SEWER') AS sewer_projects,
              (SELECT COUNT(*) FROM violations WHERE deleted_at IS NULL) AS violations,
              (SELECT COUNT(*) FROM violations WHERE deleted_at IS NULL AND project_id IS NOT NULL) AS linked_violations
            """
        ).fetchone()
        exports = conn.execute(
            """
            SELECT project_id::text, filename, violation_count, created_at
            FROM export_logs ORDER BY created_at DESC LIMIT 5
            """
        ).fetchall()
    return {
        "projects": {"water": counts[0], "sewer": counts[1]},
        "violations": counts[2],
        "linked_violations": counts[3],
        "recent_kmz_exports": [
            {"project_id": row[0], "filename": row[1], "violation_count": row[2], "created_at": row[3]}
            for row in exports
        ],
    }


@app.get("/api/violations/{violation_id}/spatial-suggestion")
def spatial_suggestion(violation_id: str) -> dict[str, Any]:
    """Return a review candidate only; never writes project_id automatically."""
    with connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM suggest_nearest_project(%s::uuid)", (violation_id,)
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="البلاغ غير موجود")
        columns = [d.name for d in cursor.description]
        return dict(zip(columns, row))


@app.get("/api/export/kmz/{project_id}")
def export_project_kmz(project_id: str, x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> FileResponse:
    """Download a project KMZ; production auth should populate X-User-Id from JWT."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="يلزم تسجيل الدخول للتصدير")
    try:
        output = generate_enterprise_kmz(project_id, x_user_id)
        with connection() as conn:
            point_count = conn.execute(
                "SELECT COUNT(*) FROM violations WHERE project_id = %s::uuid AND classification = 'INSIDE_ACTIVE_PROJECT' AND deleted_at IS NULL",
                (project_id,),
            ).fetchone()[0]
    except KMZExportError as exc:
        message = str(exc)
        status = 403 if "صلاحية" in message else 422
        raise HTTPException(status_code=status, detail=message) from exc
    return FileResponse(
        output,
        media_type="application/vnd.google-earth.kmz",
        filename=output.name,
        headers={"X-KMZ-Point-Count": str(point_count)},
        background=BackgroundTask(output.unlink, missing_ok=True),
    )
