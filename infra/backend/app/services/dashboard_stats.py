"""Role-scoped dashboard aggregation using one parameterized PostgreSQL query."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, Sequence


class QueryConnection(Protocol):
    def execute(self, query: str, params: Sequence[Any]) -> Any: ...


class DashboardStatsError(ValueError):
    """Raised for unsupported roles or invalid dashboard scope."""


@dataclass(frozen=True, slots=True)
class DashboardStats:
    total: int
    by_status: dict[str, int]


def get_dashboard_stats(connection: QueryConnection, user_id: str, role: str) -> DashboardStats:
    """Get counts visible to the JWT subject without loading individual violations."""
    allowed = {"EXECUTIVE", "SUPER_ADMIN", "PROGRAM_MANAGER", "PROJECT_MANAGER"}
    normalized_role = role.upper().strip()
    if normalized_role not in allowed or not user_id:
        raise DashboardStatsError("الدور أو user_id غير صالحين للإحصاءات")

    query = """
      WITH visible AS (
        SELECT v.source_status
        FROM violations v
        LEFT JOIN projects p ON p.id = v.project_id AND p.deleted_at IS NULL
        LEFT JOIN programs pr ON pr.id = p.program_id AND pr.deleted_at IS NULL
        WHERE v.deleted_at IS NULL
          AND (
            %s IN ('EXECUTIVE', 'SUPER_ADMIN')
            OR (%s = 'PROGRAM_MANAGER' AND pr.program_manager_id::text = %s)
            OR (%s = 'PROJECT_MANAGER' AND p.project_manager_id::text = %s)
          )
      )
      SELECT COUNT(*)::int AS total,
             COALESCE(jsonb_object_agg(source_status, status_count), '{}'::jsonb) AS by_status
      FROM (
        SELECT source_status, COUNT(*)::int AS status_count
        FROM visible
        GROUP BY source_status
      ) grouped
    """
    # Repeated role/user parameters are intentional and keep the query fully
    # parameterized; PostgreSQL can still plan this as one aggregate query.
    params = (normalized_role, normalized_role, user_id, normalized_role, user_id)
    try:
        row = connection.execute(query, params).fetchone()
    except Exception as exc:  # database driver exceptions are translated at the service boundary
        raise DashboardStatsError("تعذر جلب إحصاءات لوحة المتابعة") from exc
    if row is None:
        raise DashboardStatsError("لم تُرجع قاعدة البيانات نتيجة للإحصاءات")
    total, by_status = row
    return DashboardStats(total=int(total or 0), by_status=dict(by_status or {}))
