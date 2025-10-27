-- Switch to app DB context
\connect incident_db

-- Switch to app user
SET ROLE incident_user;

-- =========================================================
-- Add incident classification fields for AI agent safety
-- =========================================================

-- Add incident_type field (real_system, synthetic, training)
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS incident_type VARCHAR(50) DEFAULT 'synthetic'
CHECK (incident_type IN ('real_system', 'synthetic', 'training'));

-- Add actionable flag (can AI agents take automated actions?)
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS actionable BOOLEAN DEFAULT false;

-- Add affected_systems array (which systems are impacted)
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS affected_systems TEXT[] DEFAULT '{}';

-- Add remediation_mode (how should this incident be fixed?)
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS remediation_mode VARCHAR(50) DEFAULT 'advisory'
CHECK (remediation_mode IN ('automated', 'manual', 'advisory'));

-- Add metadata JSON field for extensibility
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing incidents from health-monitor/redis to be real_system
UPDATE incidents 
SET 
  incident_type = 'real_system',
  actionable = true,
  affected_systems = ARRAY['redis-test'],
  remediation_mode = 'automated'
WHERE source = 'redis-test';

-- Update existing incidents from incident-generator to be synthetic
UPDATE incidents 
SET 
  incident_type = 'synthetic',
  actionable = false,
  affected_systems = ARRAY[]::TEXT[],
  remediation_mode = 'advisory'
WHERE source NOT IN ('redis-test', 'health-monitor');

-- Create index for filtering actionable incidents
CREATE INDEX IF NOT EXISTS idx_incidents_actionable 
ON incidents(actionable) WHERE actionable = true;

-- Create index for incident type filtering
CREATE INDEX IF NOT EXISTS idx_incidents_type 
ON incidents(incident_type);

-- Create index for affected systems (GIN for array searching)
CREATE INDEX IF NOT EXISTS idx_incidents_affected_systems 
ON incidents USING GIN(affected_systems);

COMMENT ON COLUMN incidents.incident_type IS 'Classification: real_system (actual infra), synthetic (generated scenario), training (educational)';
COMMENT ON COLUMN incidents.actionable IS 'Whether AI agents are allowed to take automated remediation actions';
COMMENT ON COLUMN incidents.affected_systems IS 'List of system identifiers that are affected by this incident';
COMMENT ON COLUMN incidents.remediation_mode IS 'How the incident should be fixed: automated (AI agents), manual (human only), advisory (AI suggests)';
COMMENT ON COLUMN incidents.metadata IS 'Extensible JSON field for additional incident context';

