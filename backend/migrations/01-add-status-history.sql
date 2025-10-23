-- Switch to app DB context
\connect incident_db

-- Switch to app user
SET ROLE incident_user;

-- =========================================================
-- INCIDENT STATUS HISTORY TABLE
-- Track all status changes for each incident
-- =========================================================
CREATE TABLE IF NOT EXISTS incident_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  from_status VARCHAR(20)
    CHECK (from_status IN ('triage','investigating','fixing','resolved')),
  to_status VARCHAR(20) NOT NULL
    CHECK (to_status IN ('triage','investigating','fixing','resolved')),
  changed_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_incident
    FOREIGN KEY(incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_status_history_incident_id ON incident_status_history(incident_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON incident_status_history(changed_at);

