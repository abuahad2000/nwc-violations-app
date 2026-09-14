"""Deterministic project/KMZ reconciliation; unmatched rows stay review-only."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .kmz_parser import KMZProject


def normalize_operational_number(value: str | None) -> str | None:
    if not value:
        return None
    return re.sub(r"\s+", "", value).upper().strip()


@dataclass(frozen=True, slots=True)
class ProjectReference:
    operational_number: str
    project_name: str
    contractor_name: str | None = None
    project_manager_name: str | None = None
    program_manager_name: str | None = None
    program_subtype: str | None = None


@dataclass(frozen=True, slots=True)
class MatchedProject:
    kmz: KMZProject
    reference: ProjectReference


@dataclass(frozen=True, slots=True)
class MatchResult:
    matched: list[MatchedProject]
    unlinked: list[KMZProject]
    duplicate_reference_numbers: list[str]


def match_kmz_to_projects(
    kmz_projects: list[KMZProject],
    excel_projects: list[ProjectReference],
) -> MatchResult:
    """Match exact normalized operational numbers and enrich matched KMZ projects."""
    by_number: dict[str, list[ProjectReference]] = {}
    for reference in excel_projects:
        key = normalize_operational_number(reference.operational_number)
        if key:
            by_number.setdefault(key, []).append(reference)

    duplicates = sorted(key for key, values in by_number.items() if len(values) > 1)
    matched: list[MatchedProject] = []
    unlinked: list[KMZProject] = []
    for project in kmz_projects:
        key = normalize_operational_number(project.operational_number)
        candidates = by_number.get(key or "", [])
        if len(candidates) != 1:
            unlinked.append(project)
            continue
        matched.append(MatchedProject(kmz=project, reference=candidates[0]))
    return MatchResult(matched=matched, unlinked=unlinked, duplicate_reference_numbers=duplicates)
