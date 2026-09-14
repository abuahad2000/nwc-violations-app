"""Validated ingestion of weekly encroachment Excel files."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any, Iterable

import pandas as pd


class ExcelProcessingError(ValueError):
    """Raised when an Excel source cannot be read or mapped safely."""


class ViolationStatus(str, Enum):
    PROCESSED = "PROCESSED"
    CONTRACTOR_PROCESSING = "CONTRACTOR_PROCESSING"
    RETURNED_BY_ENTITY = "RETURNED_BY_ENTITY"
    WAITING_ENTITY_APPROVAL = "WAITING_ENTITY_APPROVAL"
    NEW = "NEW"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True, slots=True)
class ViolationRecord:
    source_reference: str
    status: ViolationStatus
    source_status: str
    latitude: float
    longitude: float
    description: str | None = None
    impact: str | None = None
    violation_date: date | None = None
    report_date: date | None = None
    contractor_name: str | None = None
    license_number: str | None = None
    city: str | None = None
    district: str | None = None
    street: str | None = None
    owner_entity: str | None = None
    violating_entity: str | None = None
    center_comment: str | None = None
    conversation_log: str | None = None


HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "source_reference": ("رقم بلاغ التعدي", "رقم البلاغ", "رقم التعدي", "report id", "id"),
    "description": ("وصف التعدي", "الوصف", "description"),
    "impact": ("أثر التعدي", "الأثر", "impact"),
    "longitude": ("خط الطول", "longitude", "lon", "x"),
    "latitude": ("خط العرض", "latitude", "lat", "y"),
    "violation_date": ("تاريخ التعدي", "violation date"),
    "report_date": ("تاريخ البلاغ", "report date"),
    "owner_entity": ("الجهة المالكة", "الجهة صاحبة الاختصاص", "owner entity"),
    "violating_entity": ("الجهة المتعدية", "الجهة المتعديّة", "violating entity"),
    "contractor_name": ("اسم المقاول", "المقاول", "contractor", "contractor name"),
    "license_number": ("رقم الرخصة", "الرخصة", "license number"),
    "source_status": ("حالة البلاغ", "الحالة", "status", "source status"),
    "city": ("المدينة", "city"),
    "district": ("الحي", "district", "neighborhood"),
    "street": ("الشارع", "street"),
    "center_comment": ("تعليق المركز", "التعليق", "center comment"),
    "conversation_log": ("سجل المحادثات", "المحادثات", "conversation log"),
}

STATUS_MAP: dict[str, ViolationStatus] = {
    "تمت المعالجة": ViolationStatus.PROCESSED,
    "معالج": ViolationStatus.PROCESSED,
    "تحت معالجة المقاول": ViolationStatus.CONTRACTOR_PROCESSING,
    "تحت المعالجة": ViolationStatus.CONTRACTOR_PROCESSING,
    "معاد من الجهة المتعدية": ViolationStatus.RETURNED_BY_ENTITY,
    "بانتظار اعتماد الجهة المتعدية": ViolationStatus.WAITING_ENTITY_APPROVAL,
    "جديد": ViolationStatus.NEW,
}


def _clean(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _normal_header(value: Any) -> str:
    text = _clean(value) or ""
    text = text.casefold().replace("ـ", "")
    return re.sub(r"[\s_()\[\]{}:؛،,/\\-]+", "", text)


def _column_map(columns: Iterable[Any]) -> dict[str, str]:
    normalized = {_normal_header(c): str(c) for c in columns}
    result: dict[str, str] = {}
    for field, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            key = _normal_header(alias)
            if key in normalized:
                result[field] = normalized[key]
                break
    required = {"source_reference", "latitude", "longitude", "source_status"}
    missing = sorted(required - result.keys())
    if missing:
        raise ExcelProcessingError(f"أعمدة Excel الإلزامية مفقودة: {', '.join(missing)}")
    return result


def _number(value: Any) -> float | None:
    text = _clean(value)
    if text is None:
        return None
    arabic = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    try:
        number = float(text.translate(arabic).replace(",", "."))
    except ValueError:
        return None
    return number if number == number else None


def _valid_coordinates(latitude: Any, longitude: Any) -> tuple[float, float] | None:
    lat, lon = _number(latitude), _number(longitude)
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return None
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return None
    return lat, lon


def _date(value: Any) -> date | None:
    if value is None or pd.isna(value):
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date() if isinstance(parsed, (datetime, pd.Timestamp)) else None


def _status(value: Any) -> tuple[ViolationStatus, str]:
    raw = _clean(value) or ""
    return STATUS_MAP.get(raw, ViolationStatus.UNKNOWN), raw


def read_violations_excel(path: str | Path, sheet_name: str | int = 0) -> list[ViolationRecord]:
    """Read, normalize, and validate violations; invalid-coordinate rows are skipped."""
    source = Path(path)
    if not source.is_file():
        raise ExcelProcessingError(f"ملف Excel غير موجود: {source}")
    try:
        frame = pd.read_excel(source, sheet_name=sheet_name, engine="openpyxl")
    except (OSError, ValueError, ImportError) as exc:
        raise ExcelProcessingError(f"تعذر قراءة ملف Excel: {exc}") from exc
    if frame.empty:
        return []
    columns = _column_map(frame.columns)
    records: list[ViolationRecord] = []
    for _, row in frame.iterrows():
        coordinates = _valid_coordinates(row.get(columns["latitude"]), row.get(columns["longitude"]))
        reference = _clean(row.get(columns["source_reference"]))
        if coordinates is None or reference is None:
            continue
        status, raw_status = _status(row.get(columns["source_status"]))
        get = lambda field: _clean(row.get(columns[field])) if field in columns else None
        records.append(
            ViolationRecord(
                source_reference=reference,
                status=status,
                source_status=raw_status,
                latitude=coordinates[0], longitude=coordinates[1],
                description=get("description"), impact=get("impact"),
                violation_date=_date(row.get(columns["violation_date"])) if "violation_date" in columns else None,
                report_date=_date(row.get(columns["report_date"])) if "report_date" in columns else None,
                contractor_name=get("contractor_name"), license_number=get("license_number"),
                city=get("city"), district=get("district"), street=get("street"),
                owner_entity=get("owner_entity"), violating_entity=get("violating_entity"),
                center_comment=get("center_comment"), conversation_log=get("conversation_log"),
            )
        )
    return records
