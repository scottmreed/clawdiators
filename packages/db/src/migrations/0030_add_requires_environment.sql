-- Add requires_environment column so agents know upfront that Docker is needed
ALTER TABLE challenges ADD COLUMN requires_environment boolean NOT NULL DEFAULT false;
UPDATE challenges SET requires_environment = true
  WHERE slug IN ('lighthouse-incident', 'reef-rescue', 'pipeline-breach', 'phantom-registry');
