-- Add provider tracking columns to incident_analysis table
ALTER TABLE incident_analysis 
ADD COLUMN IF NOT EXISTS diagnosis_provider VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS solution_provider VARCHAR(20) DEFAULT 'unknown';

-- Add comments
COMMENT ON COLUMN incident_analysis.diagnosis_provider IS 'Tracks which AI provider generated the diagnosis: gemini, groq, or error';
COMMENT ON COLUMN incident_analysis.solution_provider IS 'Tracks which AI provider generated the solution: gemini, groq, or error';

