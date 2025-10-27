-- Switch to app DB context
\connect incident_db

-- Switch to app user
SET ROLE incident_user;

-- Enable UUID generation for unique IDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- INCIDENTS TABLE
-- Minimal raw event capture: represents system-level events
-- =========================================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,                  -- raw log or error message
  source VARCHAR(255),                    -- optional: service/component name
  status VARCHAR(20)
    CHECK (status IN ('triage','investigating','fixing','resolved'))
    DEFAULT 'triage',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================
-- INCIDENT ANALYSIS TABLE
-- AI-enriched data: severity, diagnosis, and solution
-- =========================================================
CREATE TABLE IF NOT EXISTS incident_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  severity VARCHAR(10)
    CHECK (severity IN ('low', 'medium', 'high'))
    DEFAULT 'high',
  diagnosis TEXT,
  solution TEXT,
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
