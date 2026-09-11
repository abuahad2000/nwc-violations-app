import { describe, it, expect } from 'vitest';
import { classifyViolation } from '@/lib/spatial/classifier';
import { Project, ProjectBoundary } from '@/types';

describe('Spatial Classification Engine (Acceptance Tests G01 - G13)', () => {
  // Mock Active Project 1 (Riyadh Central/North: Polygon around lat 24.7-24.8, lng 46.6-46.7)
  const project1: Project = {
    id: 'proj-001',
    operational_number: 'NWC-OP-101',
    name: 'مشروع شبكة مياه شمال الرياض الجاري',
    scope_description: 'تنفيذ شبكات مياه رئيسية وفرعية',
    status: 'ACTIVE',
    contractor_id: 'cont-001',
    project_manager_id: 'mgr-001',
  };

  const boundary1: ProjectBoundary = {
    id: 'bnd-001',
    project_id: 'proj-001',
    version: 1,
    is_approved: true,
    effective_from: '2024-01-01',
    geometry: {
      type: 'Polygon',
      // Coordinates as [lng, lat]
      coordinates: [
        [
          [46.6, 24.7],
          [46.7, 24.7],
          [46.7, 24.8],
          [46.6, 24.8],
          [46.6, 24.7],
        ],
      ],
    },
  };

  // Mock Active Project 2 (Overlapping with project 1 in corner: lat 24.78-24.85, lng 46.68-46.75)
  const project2: Project = {
    id: 'proj-002',
    operational_number: 'NWC-OP-102',
    name: 'مشروع صرف صحي شمال الرياض الجاري',
    scope_description: 'تنفيذ خطوط انحدار صرف صحي',
    status: 'ACTIVE',
    contractor_id: 'cont-002',
    project_manager_id: 'mgr-002',
  };

  const boundary2: ProjectBoundary = {
    id: 'bnd-002',
    project_id: 'proj-002',
    version: 1,
    is_approved: true,
    effective_from: '2024-01-01',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [46.68, 24.78],
          [46.75, 24.78],
          [46.75, 24.85],
          [46.68, 24.85],
          [46.68, 24.78],
        ],
      ],
    },
  };

  // Mock Preliminary Handover Project (Handed over, NOT active)
  const projectHandover: Project = {
    id: 'proj-003',
    operational_number: 'NWC-OP-103',
    name: 'مشروع شبكة مياه منجز ومسلم ابتدائياً',
    scope_description: 'تم الاستلام الابتدائي للمشروع',
    status: 'PRELIMINARY_HANDOVER',
    contractor_id: 'cont-003',
  };

  const boundaryHandover: ProjectBoundary = {
    id: 'bnd-003',
    project_id: 'proj-003',
    version: 1,
    is_approved: true,
    effective_from: '2022-01-01',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [46.8, 24.6],
          [46.9, 24.6],
          [46.9, 24.7],
          [46.8, 24.7],
          [46.8, 24.6],
        ],
      ],
    },
  };

  const activeProjectDataset = [
    { project: project1, boundary: boundary1 },
    { project: project2, boundary: boundary2 },
    { project: projectHandover, boundary: boundaryHandover },
  ];

  it('G01: Points strictly inside active project are classified as INSIDE_ACTIVE_PROJECT', () => {
    // Point inside project1: lat 24.75, lng 46.65
    const res = classifyViolation(24.75, 46.65, activeProjectDataset, true);
    expect(res.classification).toBe('INSIDE_ACTIVE_PROJECT');
    expect(res.project_id).toBe('proj-001');
    expect(res.matched_contractor_id).toBe('cont-001');
    expect(res.matched_manager_id).toBe('mgr-001');
  });

  it('G01-B: Points outside all active projects have project_id=NULL and OUTSIDE_ACTIVE_PROJECTS', () => {
    // Point outside: lat 24.50, lng 46.50
    const res = classifyViolation(24.5, 46.5, activeProjectDataset, true);
    expect(res.classification).toBe('OUTSIDE_ACTIVE_PROJECTS');
    expect(res.project_id).toBeNull();
    expect(res.matched_contractor_id).toBeNull();
  });

  it('G02: No city-wide contractor exception bypass (e.g. former Aswad rule)', () => {
    // A point outside project, regardless of contractor, MUST NOT be linked to a project
    const res = classifyViolation(24.5, 46.5, activeProjectDataset, true);
    expect(res.classification).toBe('OUTSIDE_ACTIVE_PROJECTS');
    expect(res.project_id).toBeNull();
  });

  it('G04: Point inside Preliminary Handover project is NOT classified as inside active project', () => {
    // Point inside projectHandover: lat 24.65, lng 46.85
    const res = classifyViolation(24.65, 46.85, activeProjectDataset, true);
    expect(res.classification).toBe('OUTSIDE_ACTIVE_PROJECTS');
    expect(res.project_id).toBeNull();
  });

  it('G05: Missing or null coordinates are classified as REVIEW_COORDINATES with project_id=NULL', () => {
    const resNullLat = classifyViolation(null, 46.65, activeProjectDataset, true);
    expect(resNullLat.classification).toBe('REVIEW_COORDINATES');
    expect(resNullLat.project_id).toBeNull();

    const resNullLng = classifyViolation(24.75, null, activeProjectDataset, true);
    expect(resNullLng.classification).toBe('REVIEW_COORDINATES');
    expect(resNullLng.project_id).toBeNull();
  });

  it('G06: Suspected inverted coordinates (lat/lng swapped) are classified as REVIEW_COORDINATES', () => {
    // lat=46.65 (in lng range) and lng=24.75 (in lat range)
    const res = classifyViolation(46.65, 24.75, activeProjectDataset, true);
    expect(res.classification).toBe('REVIEW_COORDINATES');
    expect(res.project_id).toBeNull();
    expect(res.reason).toContain('معكوسة');
  });

  it('G07: Incomplete boundary dataset triggers REVIEW_BOUNDARIES instead of auto-outside', () => {
    // Even if point is mathematically outside, if dataset is incomplete, flag for review!
    const res = classifyViolation(24.5, 46.5, activeProjectDataset, false);
    expect(res.classification).toBe('REVIEW_BOUNDARIES');
    expect(res.project_id).toBeNull();
  });

  it('G09: Point on project boundary triggers REVIEW_BOUNDARY', () => {
    // Point directly on bottom segment of project1: lat 24.70, lng 46.65
    const res = classifyViolation(24.7, 46.65, [activeProjectDataset[0]], true);
    expect(res.classification).toBe('REVIEW_BOUNDARY');
    expect(res.project_id).toBeNull();
    expect(res.candidate_project_ids).toContain('proj-001');
  });

  it('G10: Point inside multiple overlapping projects triggers REVIEW_OVERLAP without picking first', () => {
    // Point inside intersection of project1 & project2: lat 24.79, lng 46.69
    const res = classifyViolation(24.79, 46.69, activeProjectDataset, true);
    expect(res.classification).toBe('REVIEW_OVERLAP');
    expect(res.project_id).toBeNull();
    expect(res.candidate_project_ids).toHaveLength(2);
    expect(res.candidate_project_ids).toContain('proj-001');
    expect(res.candidate_project_ids).toContain('proj-002');
  });
});
