"""End-to-end checks against the supplied KMZ and weekly violations Excel files.

Usage:
  python scripts/test_integration.py
  python scripts/test_integration.py --contractors path/to/projects.xlsx
"""

from __future__ import annotations

import argparse
import random
from collections import Counter
from pathlib import Path

from shapely.geometry import Point
from shapely.validation import explain_validity
from shapely import wkt

from app.services.excel_processor import ExcelProcessingError, read_violations_excel
from app.services.kmz_parser import KMZProcessingError, KMZProject, parse_kmz


DOWNLOADS = Path(r"C:\Users\USER\Downloads")
WATER_KMZ = DOWNLOADS / "مشاريع المياه بمدينة الرياض .kmz"
SEWER_KMZ = DOWNLOADS / "- مشاريع الصرف الصحي بمدينة الرياض.kmz"
VIOLATIONS_XLSX = DOWNLOADS / "بلاغات تعدي مقاولي شركة المياه الوطنية 12 سبتمبر.xlsx"


def check_kmz(path: Path, label: str) -> list[KMZProject]:
    projects = parse_kmz(path, current_only=True)
    valid = 0
    for project in projects:
        geometry = wkt.loads(project.geometry_wkt)
        if geometry.is_valid:
            valid += 1
        else:
            print(f"WARN {label}: {project.name}: {explain_validity(geometry)}")
    sample = random.Random(42).sample(projects, min(10, len(projects)))
    extracted = sum(1 for project in sample if project.operational_number)
    print(f"{label}: current_projects={len(projects)}, valid_wkt={valid}, sample_operational_numbers={extracted}/{len(sample)}")
    return projects


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--water", type=Path, default=WATER_KMZ)
    parser.add_argument("--sewer", type=Path, default=SEWER_KMZ)
    parser.add_argument("--violations", type=Path, default=VIOLATIONS_XLSX)
    parser.add_argument("--contractors", type=Path, default=None, help="Optional projects/contractors Excel")
    args = parser.parse_args()

    try:
        water = check_kmz(args.water, "WATER")
        sewer = check_kmz(args.sewer, "SEWER")
        violations = read_violations_excel(args.violations)
    except (KMZProcessingError, ExcelProcessingError) as exc:
        print(f"ERROR: {exc}")
        return 1

    in_riyadh_box = [v for v in violations if 24 <= v.latitude <= 25 and 46 <= v.longitude <= 47]
    print(f"VIOLATIONS: valid_rows={len(violations)}, Riyadh_box={len(in_riyadh_box)}/{len(violations)}")
    print("STATUS_COUNTS:", dict(Counter(v.source_status for v in violations)))
    if args.contractors:
        print(f"CONTRACTOR_REFERENCE: supplied={args.contractors} (column audit is separate from spatial test)")
    else:
        print("WARN CONTRACTOR_REFERENCE: not supplied; exact contractor reconciliation was not tested")

    scopes = [(p, wkt.loads(p.geometry_wkt)) for p in [*water, *sewer]]
    matched = 0
    boundary = 0
    for violation in violations:
        point = Point(violation.longitude, violation.latitude)
        inside = [project for project, geometry in scopes if geometry.contains(point)]
        on_boundary = [project for project, geometry in scopes if geometry.covers(point) and not geometry.contains(point)]
        if len(inside) == 1:
            matched += 1
        elif on_boundary:
            boundary += 1
    ratio = matched / len(violations) if violations else 0
    print(f"SPATIAL_JOIN: inside_one_current_scope={matched}, boundary_review={boundary}, success_ratio={ratio:.2%}")
    if ratio < 0.70:
        print("WARN SPATIAL_JOIN: ratio is below the requested 70% threshold; inspect active-layer filtering and source coordinates.")
    print("RESULT: completed with data-quality findings reported above")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
