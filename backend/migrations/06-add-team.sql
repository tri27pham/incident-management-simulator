-- Add team field to incidents table
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS team VARCHAR(100) DEFAULT 'Platform';

