-- Nitaq / PostgreSQL + PostGIS reference schema
-- This file is for a new local database only. It does not migrate or delete
-- an existing production database.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('ACTIVE', 'PRELIMINARY_HANDOVER', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE spatial_classification AS ENUM (
    'INSIDE_ACTIVE_PROJECT', 'OUTSIDE_ACTIVE_PROJECTS', 'REVIEW_COORDINATES',
    'REVIEW_BOUNDARIES', 'REVIEW_OVERLAP', 'REVIEW_BOUNDARY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN', 'EXECUTIVE', 'PROGRAM_MANAGER', 'PROJECT_MANAGER',
    'EDITOR', 'READER', 'CONTRACTOR_USER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every import is versioned so a weekly Excel/KMZ refresh is traceable and
-- can be rejected as a duplicate before it changes operational data.
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('VIOLATIONS_EXCEL', 'PROJECTS_EXCEL', 'KMZ')),
  source_filename TEXT NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  source_modified_at TIMESTAMPTZ,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_sha256)
);

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  commercial_reg TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_name TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE,
  canonical_contractor_id UUID NOT NULL REFERENCES contractors(id),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  program_manager_id UUID REFERENCES users(id),
  program_manager_name TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'READER',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scope_description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('WATER', 'SEWER')),
  status project_status NOT NULL DEFAULT 'ACTIVE',
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  program_id UUID REFERENCES programs(id),
  project_manager_id UUID REFERENCES users(id),
  project_manager_name TEXT,
  program_manager_name TEXT,
  subprogram TEXT,
  source_import_id UUID REFERENCES import_batches(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KMZ is retained as immutable source metadata; only explicitly current layers
-- are eligible for active classification.
CREATE TABLE IF NOT EXISTS gis_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('WATER', 'SEWER')),
  layer_kind TEXT NOT NULL CHECK (layer_kind IN ('CURRENT', 'DELIVERED', 'FUTURE', 'OTHER')),
  source_filename TEXT NOT NULL,
  source_import_id UUID REFERENCES import_batches(id),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  gis_layer_id UUID NOT NULL REFERENCES gis_layers(id),
  -- MultiPolygon supports a project represented by several disconnected areas.
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  extracted_operational_number TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_reference TEXT NOT NULL UNIQUE,
  description TEXT,
  impact TEXT,
  longitude NUMERIC(10,7),
  latitude NUMERIC(10,7),
  -- Point uses longitude/latitude in WGS84, matching Excel/KMZ/GeoJSON.
  geom GEOMETRY(Point, 4326),
  violation_date DATE,
  report_date DATE,
  owner_entity TEXT,
  violating_entity TEXT,
  reported_contractor_name TEXT,
  reported_contractor_id UUID REFERENCES contractors(id),
  license_number TEXT,
  source_status TEXT NOT NULL,
  city TEXT,
  district TEXT,
  street TEXT,
  center_comment TEXT,
  conversation_log TEXT,
  raw_operational_number TEXT,
  project_id UUID REFERENCES projects(id),
  classification spatial_classification NOT NULL DEFAULT 'REVIEW_COORDINATES',
  classification_reason TEXT NOT NULL DEFAULT 'لم ينفذ التصنيف المكاني بعد',
  classification_run_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_import_id UUID REFERENCES import_batches(id),
  CONSTRAINT chk_project_only_when_inside CHECK (
    (classification = 'INSIDE_ACTIVE_PROJECT' AND project_id IS NOT NULL)
    OR (classification <> 'INSIDE_ACTIVE_PROJECT' AND project_id IS NULL)
  ),
  CONSTRAINT chk_point_pair CHECK ((longitude IS NULL AND latitude IS NULL) OR (longitude IS NOT NULL AND latitude IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS spatial_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id UUID NOT NULL REFERENCES violations(id),
  project_id UUID REFERENCES projects(id),
  relation TEXT NOT NULL CHECK (relation IN ('INSIDE', 'BOUNDARY', 'OVERLAP', 'NEAREST_SUGGESTION')),
  distance_m NUMERIC(12,3),
  is_authoritative BOOLEAN NOT NULL DEFAULT false,
  reason TEXT NOT NULL,
  classification_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES users(id),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  exported_by UUID REFERENCES users(id),
  format TEXT NOT NULL CHECK (format IN ('KMZ', 'EXCEL')),
  violation_count INTEGER NOT NULL DEFAULT 0,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violations_geom ON violations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_project_scopes_geom ON project_scopes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_scopes_active_layer ON project_scopes (gis_layer_id, project_id);
CREATE INDEX IF NOT EXISTS idx_violations_classification ON violations (classification);
CREATE INDEX IF NOT EXISTS idx_violations_contractor ON violations (reported_contractor_id);
CREATE INDEX IF NOT EXISTS idx_violations_source_status ON violations (source_status);
CREATE INDEX IF NOT EXISTS idx_projects_operational_number ON projects (operational_number);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contractors','contractor_aliases','programs','users','projects','gis_layers','project_scopes','violations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- Build the point from source coordinates without changing the source values.
CREATE OR REPLACE FUNCTION set_violation_point() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.longitude IS NULL OR NEW.latitude IS NULL THEN
    NEW.geom := NULL;
  ELSIF NEW.longitude BETWEEN -180 AND 180 AND NEW.latitude BETWEEN -90 AND 90 THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  ELSE
    NEW.geom := NULL;
    NEW.classification := 'REVIEW_COORDINATES';
    NEW.classification_reason := 'الإحداثيات خارج القيم الجغرافية الممكنة';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_violations_point ON violations;
CREATE TRIGGER trg_violations_point BEFORE INSERT OR UPDATE OF longitude, latitude ON violations
FOR EACH ROW EXECUTE FUNCTION set_violation_point();

CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor UUID;
BEGIN
  actor := NULLIF(current_setting('nitaq.actor_id', true), '')::uuid;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs(entity_type, entity_id, action, performed_by, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, actor, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  INSERT INTO audit_logs(entity_type, entity_id, action, performed_by, old_values, new_values)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, actor, CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','gis_layers','project_scopes','violations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t, t);
  END LOOP;
END $$;

-- Active approved scope view: delivered/future/maintenance layers are never
-- considered by the authoritative spatial classification.
CREATE OR REPLACE VIEW active_approved_project_scopes AS
SELECT ps.*, p.operational_number, p.name AS project_name, p.contractor_id,
       gl.service_type
FROM project_scopes ps
JOIN projects p ON p.id = ps.project_id AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
JOIN gis_layers gl ON gl.id = ps.gis_layer_id
  AND gl.layer_kind = 'CURRENT' AND gl.is_approved = true AND gl.deleted_at IS NULL
WHERE ps.deleted_at IS NULL AND ps.is_valid = true;

-- Nearest-project helper for a missing operating number. This deliberately
-- returns a suggestion and never writes project_id or changes classification.
CREATE OR REPLACE FUNCTION suggest_nearest_project(p_violation_id UUID)
RETURNS TABLE (
  violation_id UUID,
  suggestion_available BOOLEAN,
  project_id UUID,
  operational_number TEXT,
  project_name TEXT,
  contractor_id UUID,
  distance_m NUMERIC,
  reason TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT v.id AS vid, s.project_id, s.operational_number, s.project_name,
           s.contractor_id,
           ST_Distance(v.geom::geography, s.geom::geography) AS metres
    FROM violations v
    JOIN active_approved_project_scopes s ON v.geom IS NOT NULL
      AND ST_DWithin(v.geom::geography, s.geom::geography, 50)
    WHERE v.id = p_violation_id
    ORDER BY metres ASC, s.project_id
    LIMIT 1
  )
  SELECT p_violation_id, (c.project_id IS NOT NULL), c.project_id,
         c.operational_number, c.project_name, c.contractor_id,
         round(c.metres::numeric, 3),
         CASE WHEN c.project_id IS NULL THEN 'لا يوجد مشروع جارٍ معتمد ضمن 50 متراً'
              ELSE 'مرشح مراجعة مكانية فقط؛ لا يعتبر ربطاً معتمداً' END
  FROM (SELECT NULL::uuid AS project_id, NULL::text AS operational_number,
               NULL::text AS project_name, NULL::uuid AS contractor_id,
               NULL::double precision AS metres
        WHERE NOT EXISTS (SELECT 1 FROM violations WHERE id = p_violation_id)
        UNION ALL
        SELECT project_id, operational_number, project_name, contractor_id, metres FROM candidate) c;
END; $$;
