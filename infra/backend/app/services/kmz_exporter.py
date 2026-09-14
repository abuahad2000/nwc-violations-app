"""Enterprise KMZ export for an authorized project manager or administrator."""

from __future__ import annotations

import html
import os
import re
import tempfile
from contextlib import closing
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
import simplekml
from shapely import wkt


class KMZExportError(RuntimeError):
    """Raised when authorization, source data, or KMZ generation fails."""


STATUS_COLORS: dict[str, str] = {
    "processed": simplekml.Color.green,
    "contractor": simplekml.Color.orange,
    "returned": simplekml.Color.purple,
    "approval": simplekml.Color.yellow,
    "default": simplekml.Color.red,
}


def _as_uuid(value: str | int | UUID, field: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, AttributeError) as exc:
        raise KMZExportError(f"{field} يجب أن يكون UUID صالحًا") from exc


def _safe_text(value: Any) -> str:
    if value is None:
        return "غير محدد"
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _status_color(status: str) -> str:
    text = status.casefold()
    if "تمت" in text or "معالج" in text:
        return STATUS_COLORS["processed"]
    if "مقاول" in text:
        return STATUS_COLORS["contractor"]
    if "معاد" in text:
        return STATUS_COLORS["returned"]
    if "انتظار" in text or "اعتماد" in text:
        return STATUS_COLORS["approval"]
    return STATUS_COLORS["default"]


def _description(row: dict[str, Any]) -> str:
    """Build escaped RTL HTML so source text cannot inject markup into Earth."""
    values = [
        ("رقم البلاغ", _safe_text(row["source_reference"])),
        ("الحالة", _safe_text(row["source_status"])),
        ("التاريخ", _safe_text(row["report_date"])),
        ("اسم المقاول", _safe_text(row["reported_contractor_name"])),
        ("أثر التعدي", _safe_text(row["impact"])),
    ]
    rows = "".join(
        f'<tr><th style="background:#eef5f7;text-align:right;padding:7px">{html.escape(label)}</th>'
        f'<td style="padding:7px;border-bottom:1px solid #d9e4e7">{html.escape(value)}</td></tr>'
        for label, value in values
    )
    return (
        '<div dir="rtl" style="font-family:Arial,sans-serif;min-width:280px;color:#173f43">'
        '<h3 style="margin:0 0 10px;color:#0b6570">بلاغ تعدي — نطاق</h3>'
        f'<table style="border-collapse:collapse;width:100%;font-size:13px">{rows}</table>'
        '</div>'
    )


def _add_polygon(kml: simplekml.Kml, geometry: Any, name: str) -> None:
    for index, polygon in enumerate(geometry.geoms if geometry.geom_type == "MultiPolygon" else [geometry], start=1):
        placemark = kml.newpolygon(name=name if index == 1 else f"{name} ({index})")
        placemark.outerboundaryis = [(float(x), float(y)) for x, y, *_ in polygon.exterior.coords]
        placemark.innerboundaryis = [
            [(float(x), float(y)) for x, y, *_ in ring.coords]
            for ring in polygon.interiors
        ]
        placemark.style.polystyle.color = simplekml.Color.changealphaint(90, simplekml.Color.blue)
        placemark.style.linestyle.color = simplekml.Color.blue
        placemark.style.linestyle.width = 3


def generate_enterprise_kmz(project_id: str | int, user_id: str | int) -> Path:
    """Generate a temporary KMZ and return its path for a FileResponse.

    The function exports only the project's approved active scopes and
    violations whose authoritative project_id matches it. It never changes
    classification or coordinates.
    """
    project_uuid = _as_uuid(project_id, "project_id")
    user_uuid = _as_uuid(user_id, "user_id")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise KMZExportError("DATABASE_URL غير مهيأ")

    try:
        with closing(psycopg.connect(database_url)) as conn:
            project = conn.execute(
                """
                SELECT p.id, p.name, p.operational_number, u.role::text,
                       COALESCE(pr.name, p.subprogram, 'غير محدد')
                FROM projects p
                LEFT JOIN users u ON u.id = %s AND u.deleted_at IS NULL
                LEFT JOIN programs pr ON pr.id = p.program_id
                WHERE p.id = %s AND p.deleted_at IS NULL
                """,
                (str(user_uuid), str(project_uuid)),
            ).fetchone()
            if project is None or project[3] is None:
                raise KMZExportError("المشروع غير موجود أو المستخدم غير مصرح له")
            role = project[3]
            allowed = role in {"SUPER_ADMIN", "EXECUTIVE", "PROGRAM_MANAGER"}
            if role == "PROJECT_MANAGER":
                allowed = conn.execute(
                    "SELECT EXISTS (SELECT 1 FROM projects WHERE id = %s AND project_manager_id = %s)",
                    (str(project_uuid), str(user_uuid)),
                ).fetchone()[0]
            if not allowed:
                raise KMZExportError("لا تملك صلاحية تصدير هذا المشروع")

            scope_rows = conn.execute(
                """
                SELECT geom::text
                FROM active_approved_project_scopes
                WHERE project_id = %s
                """,
                (str(project_uuid),),
            ).fetchall()
            if not scope_rows:
                raise KMZExportError("لا يوجد نطاق جاري معتمد لهذا المشروع")
            violation_rows = conn.execute(
                """
                SELECT source_reference, source_status, report_date,
                       reported_contractor_name, impact, longitude, latitude
                FROM violations
                WHERE project_id = %s AND classification = 'INSIDE_ACTIVE_PROJECT'
                  AND deleted_at IS NULL
                ORDER BY report_date NULLS LAST, source_reference
                """,
                (str(project_uuid),),
            ).fetchall()
            violation_columns = ["source_reference", "source_status", "report_date", "reported_contractor_name", "impact", "longitude", "latitude"]

            kml = simplekml.Kml(name=f"نطاق — {_safe_text(project[1])}")
            scope_folder = kml.newfolder(name="حدود المشروع المعتمدة")
            for index, (geometry_wkt,) in enumerate(scope_rows, start=1):
                geometry = wkt.loads(geometry_wkt)
                if geometry.geom_type not in {"Polygon", "MultiPolygon"}:
                    continue
                _add_polygon(scope_folder, geometry, f"نطاق المشروع {index}")

            violations_folder = kml.newfolder(name="بلاغات التعدي")
            counts: dict[str, int] = {}
            for raw_row in violation_rows:
                row = dict(zip(violation_columns, raw_row))
                status = _safe_text(row["source_status"])
                counts[status] = counts.get(status, 0) + 1
                if row["longitude"] is None or row["latitude"] is None:
                    continue
                point = violations_folder.newpoint(
                    name=f"بلاغ {row['source_reference']}",
                    coords=[(float(row["longitude"]), float(row["latitude"]))],
                )
                point.description = _description(row)
                point.style.iconstyle.color = _status_color(status)
                point.style.iconstyle.scale = 1.1
                point.style.iconstyle.icon.href = "http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png"

            centroid = conn.execute(
                """
                SELECT ST_X(ST_PointOnSurface(ST_UnaryUnion(ST_Collect(geom)))) AS lon,
                       ST_Y(ST_PointOnSurface(ST_UnaryUnion(ST_Collect(geom)))) AS lat
                FROM active_approved_project_scopes WHERE project_id = %s
                """,
                (str(project_uuid),),
            ).fetchone()
            if centroid and centroid[0] is not None and centroid[1] is not None:
                summary = kml.newpoint(name="ملخص المشروع", coords=[(float(centroid[0]), float(centroid[1]))])
                distribution = "".join(f"<li>{html.escape(key)}: {value}</li>" for key, value in sorted(counts.items()))
                summary.description = (
                    f'<div dir="rtl" style="font-family:Arial,sans-serif">'
                    f'<h2 style="color:#0b6570">ملخص مشروع {_safe_text(project[1])}</h2>'
                    f'<p><b>الرقم التشغيلي:</b> {html.escape(_safe_text(project[2]))}</p>'
                    f'<p><b>إجمالي البلاغات:</b> {len(violation_rows)}</p>'
                    f'<h3>توزيع الحالات</h3><ul>{distribution or "<li>لا توجد بلاغات</li>"}</ul></div>'
                )
                summary.style.iconstyle.color = simplekml.Color.blue
                summary.style.iconstyle.scale = 1.4

            filename = f"nitaq-project-{re.sub(r'[^A-Za-z0-9_-]+', '-', _safe_text(project[2]))}.kmz"
            file_descriptor, output_name = tempfile.mkstemp(prefix="nitaq-", suffix=".kmz")
            os.close(file_descriptor)
            output = Path(output_name)
            try:
                kml.savekmz(str(output))
                conn.execute(
                    "INSERT INTO export_logs(project_id, exported_by, format, violation_count, filename) VALUES (%s,%s,'KMZ',%s,%s)",
                    (str(project_uuid), str(user_uuid), len(violation_rows), filename),
                )
                conn.commit()
            except Exception:
                output.unlink(missing_ok=True)
                raise
            return output
    except KMZExportError:
        raise
    except Exception as exc:
        raise KMZExportError("تعذر إنشاء ملف KMZ") from exc
