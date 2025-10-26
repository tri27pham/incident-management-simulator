-- Migration: Add fields for agent/health monitor support
-- These fields allow storing system metrics and error details for AI agent analysis

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS affected_system VARCHAR(100);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS error_logs TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS metrics_snapshot JSONB;

-- Add comments for documentation
COMMENT ON COLUMN incidents.affected_system IS 'The system affected by this incident (e.g., redis-test, postgres-test)';
COMMENT ON COLUMN incidents.error_logs IS 'JSON array of error messages from the affected system';
COMMENT ON COLUMN incidents.metrics_snapshot IS 'System metrics at the time of incident creation (e.g., memory usage, connection count)';

