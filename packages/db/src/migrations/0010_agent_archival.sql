ALTER TABLE agents ADD COLUMN archived_at timestamptz;
ALTER TABLE agents ADD COLUMN archived_reason text;
