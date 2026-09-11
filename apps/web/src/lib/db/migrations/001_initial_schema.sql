-- ========================================================================
-- Migration 001: Initial PostGIS Schema & Invariants for NWC Scope System
-- Strictly aligns with DATA_DICTIONARY_AR.md & nwc-engineering-security.md
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Organizations & Roles
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'PROGRAM_MANAGER',
  'PROJECT_MANAGER',
  'EDITOR',
  'READER',
  'CONTRACTOR_USER'
);

CREATE TYPE project_status AS ENUM (
  'ACTIVE',
  'PRELIMINARY_HANDOVER',
  'WITHDRAWN'
);

CREATE TYPE spatial_classification AS ENUM (
  'INSIDE_ACTIVE_PROJECT',
  'OUTSIDE_ACTIVE_PROJECTS',
  'REVIEW_COORDINATES',
  'REVIEW_BOUNDARIES',
  'REVIEW_OVERLAP',
  'REVIEW_BOUNDARY'
);

-- 2. Contractors & Canonical Aliases
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  commercial_reg VARCHAR(64),
  is_approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias_name VARCHAR(255) NOT NULL UNIQUE,
  canonical_contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Programs & Projects
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) UNIQUE,
  program_manager_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operational_number VARCHAR(128) NOT NULL UNIQUE, -- الرقم التشغيلي
  name VARCHAR(255) NOT NULL,
  scope_description TEXT,
  status project_status NOT NULL DEFAULT 'ACTIVE',
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  program_id UUID REFERENCES programs(id),
  program_manager_name VARCHAR(255),
  project_manager_name VARCHAR(255),
  po_number VARCHAR(128),
  consultant_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Spatial Boundaries
CREATE TABLE IF NOT EXISTS boundary_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number INT NOT NULL,
  dataset_name VARCHAR(255) NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_boundaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boundary_version_id UUID NOT NULL REFERENCES boundary_versions(id) ON DELETE CASCADE,
  geom GEOMETRY(Geometry, 4326) NOT NULL, -- Polygons / MultiPolygons
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_boundaries_geom ON project_boundaries USING GIST(geom);

-- 5. Violations & Spatial Classifications
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_reference VARCHAR(128) NOT NULL UNIQUE, -- رقم بلاغ التعدي

  -- Separation of Actors (Rule 6, Rule 11 & Test S04)
  reported_contractor_name VARCHAR(255), -- مقاول البلاغ بالمصدر
  reported_contractor_id UUID REFERENCES contractors(id),
  project_contractor_id UUID REFERENCES contractors(id), -- مقاول المشروع المرتبط
  current_action_owner_id UUID REFERENCES contractors(id), -- صاحب الإجراء الحالي
  project_id UUID REFERENCES projects(id), -- المشروع المكاني المعتمد

  -- Spatial data
  longitude NUMERIC(10, 7),
  latitude NUMERIC(10, 7),
  geom GEOMETRY(Point, 4326),

  -- Classification
  classification spatial_classification NOT NULL DEFAULT 'REVIEW_COORDINATES',
  classification_reason TEXT,
  classification_run_id UUID,

  -- Metadata & Timestamps
  source_status VARCHAR(128) NOT NULL DEFAULT 'جديد',
  reported_date DATE,
  incident_date DATE,
  age_days INT, -- Numerical age (Rule 14 & Rule A08)
  description_raw TEXT,
  district_raw VARCHAR(255),
  street_raw VARCHAR(255),
  city_raw VARCHAR(128),
  is_closed BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Database-level check constraint enforcing Rule 7 & Rule 10:
  -- project_id CANNOT be set unless classification is INSIDE_ACTIVE_PROJECT!
  CONSTRAINT chk_project_id_inside CHECK (
    (classification = 'INSIDE_ACTIVE_PROJECT' AND project_id IS NOT NULL) OR
    (classification != 'INSIDE_ACTIVE_PROJECT' AND project_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_violations_geom ON violations USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_violations_classification ON violations(classification);
CREATE INDEX IF NOT EXISTS idx_violations_reported_contractor ON violations(reported_contractor_name);
CREATE INDEX IF NOT EXISTS idx_violations_age ON violations(age_days);

-- 6. Audit & History Logging
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(64) NOT NULL,
  performed_by UUID,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Row Level Security (RLS) Enablement
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_boundaries ENABLE ROW LEVEL SECURITY;
