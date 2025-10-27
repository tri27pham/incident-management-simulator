-- Switch to app DB context
\connect incident_db

-- Switch to app user
SET ROLE incident_user;

-- =========================================================
-- Agent Execution Tracking
-- Tracks AI agent remediation attempts with full workflow
-- =========================================================

CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  
  -- Execution metadata
  status VARCHAR(50) NOT NULL DEFAULT 'thinking'
    CHECK (status IN ('thinking', 'previewing', 'awaiting_approval', 'executing', 'verifying', 'completed', 'failed', 'cancelled')),
  
  -- Phase: Thinking
  analysis TEXT,                          -- AI's analysis of the incident
  recommended_action VARCHAR(100),        -- Action to take (e.g., "clear_redis_cache")
  reasoning TEXT,                         -- Why this action was chosen
  
  -- Phase: Command Preview
  commands JSONB DEFAULT '[]',            -- Array of commands to execute
  estimated_impact TEXT,                  -- Expected impact of commands
  risks JSONB DEFAULT '[]',              -- Identified risks
  
  -- Phase: Execution
  execution_logs JSONB DEFAULT '[]',      -- Array of {timestamp, command, output, status}
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Phase: Verification
  verification_checks JSONB DEFAULT '[]', -- Array of {check, result, passed}
  verification_passed BOOLEAN,
  verification_notes TEXT,
  
  -- Outcome
  success BOOLEAN,
  error_message TEXT,
  rollback_performed BOOLEAN DEFAULT false,
  
  -- Metadata
  agent_model VARCHAR(50),                -- e.g., "gemini-2.5-flash", "groq"
  dry_run BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_executions_incident 
ON agent_executions(incident_id);

CREATE INDEX IF NOT EXISTS idx_agent_executions_status 
ON agent_executions(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_execution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_execution_updated
  BEFORE UPDATE ON agent_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_execution_timestamp();

COMMENT ON TABLE agent_executions IS 'Tracks AI agent remediation attempts with full multi-phase workflow';
COMMENT ON COLUMN agent_executions.status IS 'Current phase: thinking → previewing → awaiting_approval → executing → verifying → completed/failed';
COMMENT ON COLUMN agent_executions.commands IS 'Array of commands to execute: [{cmd, args, target}]';
COMMENT ON COLUMN agent_executions.execution_logs IS 'Detailed execution logs with timestamps and outputs';
COMMENT ON COLUMN agent_executions.verification_checks IS 'Verification results: [{check_name, result, passed}]';

