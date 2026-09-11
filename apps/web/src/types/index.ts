/**
 * Domain Models & Invariant Types
 * Strictly following DATA_DICTIONARY_AR.md & nwc-domain-invariants.md
 */

export type ProjectStatus = 'ACTIVE' | 'PRELIMINARY_HANDOVER' | 'WITHDRAWN';

export type SpatialClassification =
  | 'INSIDE_ACTIVE_PROJECT'
  | 'OUTSIDE_ACTIVE_PROJECTS'
  | 'REVIEW_COORDINATES'
  | 'REVIEW_BOUNDARIES'
  | 'REVIEW_OVERLAP'
  | 'REVIEW_BOUNDARY';

export type UserRole =
  'SUPER_ADMIN' | 'PROGRAM_MANAGER' | 'PROJECT_MANAGER' | 'EDITOR' | 'READER' | 'CONTRACTOR_USER';

export interface Contractor {
  id: string;
  name: string;
  is_approved: boolean;
  created_at: string;
}

export interface ContractorAlias {
  id: string;
  alias_name: string;
  canonical_contractor_id: string;
  is_approved: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface Project {
  id: string;
  operational_number: string; // الرقم التشغيلي
  name: string;
  scope_description: string;
  status: ProjectStatus;
  contractor_id: string; // مقاول المشروع
  program_manager_id?: string | null;
  project_manager_id?: string | null;
  boundary_version_id?: string | null;
}

export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] in GeoJSON
}

export interface PolygonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface ProjectBoundary {
  id: string;
  project_id: string;
  version: number;
  geometry: PolygonGeometry;
  is_approved: boolean;
  effective_from: string;
  effective_to?: string | null;
}

export interface ViolationSourceRecord {
  source_reference: string;
  source_contractor_name?: string | null; // مقاول البلاغ الوارد بالمصدر
  reported_date?: string | null;
  incident_date?: string | null;
  source_status?: string | null;
  description_raw?: string | null;
  district_raw?: string | null;
  street_raw?: string | null;
  city_raw?: string | null;
  latitude_raw?: number | null;
  longitude_raw?: number | null;
}

export interface Violation {
  id: string;
  source_reference: string;

  // Separation of the 4 key actors (Rule 6 & Rule 11):
  reported_contractor_name: string | null; // 1. مقاول البلاغ
  project_contractor_id: string | null; // 2. مقاول المشروع (فقط عند الارتباط الداخلي)
  current_action_owner_id: string | null; // 3. صاحب الإجراء الحالي
  project_id: string | null; // 4. المشروع المكاني المعتمد (فقط عند INSIDE_ACTIVE_PROJECT)

  // Coordinates
  latitude: number | null;
  longitude: number | null;

  // Classification
  classification: SpatialClassification;
  classification_reason: string;
  classification_run_id?: string | null;

  // Dates & Age
  reported_date: string | null;
  age_days: number | null; // Strictly numerical (Rule 14 & Rule A08)

  // Source metadata
  source_status: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassificationResult {
  classification: SpatialClassification;
  project_id: string | null;
  project_name: string | null;
  matched_contractor_id: string | null;
  matched_manager_id: string | null;
  reason: string;
  candidate_project_ids?: string[]; // In case of REVIEW_OVERLAP
}

export interface SessionUser {
  must_change_password?: boolean;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  contractor_id?: string | null; // Present only if role is CONTRACTOR_USER
  department_id?: string | null;
}
