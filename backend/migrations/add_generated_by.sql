-- Add generated_by column to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS generated_by VARCHAR(20) DEFAULT 'manual';

-- Add comment to explain the column
COMMENT ON COLUMN incidents.generated_by IS 'Tracks which AI provider generated the incident: gemini, groq, fallback, or manual';

