ALTER TABLE manual_responsibility ADD COLUMN IF NOT EXISTS responsibility_type TEXT NOT NULL DEFAULT 'MAINTENANCE';
CREATE INDEX IF NOT EXISTS manual_responsibility_type ON manual_responsibility(responsibility_type);
