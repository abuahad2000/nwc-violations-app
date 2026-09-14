"""Safe KMZ/KML parsing with operational-number extraction."""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator
from xml.etree.ElementTree import ParseError

from fastkml import kml
from shapely.geometry import MultiPolygon, Polygon, shape


class KMZProcessingError(ValueError):
    """Raised when KMZ is missing, malformed, or contains unsupported geometry."""


@dataclass(frozen=True, slots=True)
class KMZProject:
    name: str
    operational_number: str | None
    layer_name: str | None
    service_type: str | None
    is_current: bool
    geometry_wkt: str


# Supports examples such as 24/23/2/02/0013/1 and 24/25/2/14/AP3500/1.
OPERATIONAL_NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9])\d{2}/\d{2}/\d{1,3}/\d{1,3}/[A-Za-z0-9-]+/\d{1,3}(?![A-Za-z0-9])",
    re.IGNORECASE,
)


def _features(container: Any) -> Iterator[Any]:
    children = container.features() if callable(getattr(container, "features", None)) else getattr(container, "features", ())
    for child in children or ():
        yield child
        yield from _features(child)


def _geometry(feature: Any) -> Any | None:
    candidate = getattr(feature, "geometry", None)
    if candidate is None:
        return None
    try:
        geometry = shape(candidate) if isinstance(candidate, dict) else candidate
    except (TypeError, ValueError):
        return None
    if geometry.is_empty:
        return None
    if geometry.geom_type == "Polygon":
        return MultiPolygon([geometry])
    if geometry.geom_type == "MultiPolygon":
        return geometry
    if geometry.geom_type in {"GeometryCollection", "MultiLineString"}:
        polygons = [g for g in getattr(geometry, "geoms", ()) if g.geom_type == "Polygon"]
        return MultiPolygon(polygons) if polygons else None
    return None


def _service_type(layer: str) -> str | None:
    text = layer.casefold()
    if "صرف" in text or "sewer" in text:
        return "SEWER"
    if "مياه" in text or "ماء" in text or "water" in text:
        return "WATER"
    return None


def _is_current(layer: str, name: str) -> bool:
    text = f"{layer} {name}".casefold()
    delivered = ("مسلم" in text or "مسلمة" in text or "منفذ" in text or "منفذة" in text
                 or "delivered" in text or "completed" in text)
    current = "جاري" in text or "جارية" in text or "current" in text or "ongoing" in text
    return current and not delivered


def parse_kmz(path: str | Path, current_only: bool = False) -> list[KMZProject]:
    """Parse Polygon/MultiPolygon KMZ features and return WKT boundaries."""
    source = Path(path)
    if not source.is_file():
        raise KMZProcessingError(f"ملف KMZ غير موجود: {source}")
    try:
        with zipfile.ZipFile(source) as archive:
            names = [n for n in archive.namelist() if n.casefold().endswith(".kml")]
            if not names:
                raise KMZProcessingError("ملف KMZ لا يحتوي على KML")
            document = kml.KML.from_string(archive.read(names[0]))
    except (zipfile.BadZipFile, OSError, KeyError, ParseError, ValueError) as exc:
        raise KMZProcessingError(f"تعذر تحليل KMZ: {exc}") from exc

    parsed: list[KMZProject] = []
    for feature in _features(document):
        geometry = _geometry(feature)
        if geometry is None:
            continue
        name = str(getattr(feature, "name", None) or "").strip()
        layer = str(getattr(getattr(feature, "parent", None), "name", None) or "").strip() or None
        layer_text = layer or ""
        current = _is_current(layer_text, name)
        if current_only and not current:
            continue
        parsed.append(KMZProject(
            name=name or "بدون اسم",
            operational_number=(OPERATIONAL_NUMBER_RE.search(name) or [None])[0],
            layer_name=layer,
            service_type=_service_type(layer_text),
            is_current=current,
            geometry_wkt=geometry.wkt,
        ))
    return parsed
