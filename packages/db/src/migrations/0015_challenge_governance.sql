-- Challenge governance: gate runner + reviewer quorum
ALTER TABLE challenge_drafts
  ADD COLUMN gate_status text NOT NULL DEFAULT 'pending_gates',
  ADD COLUMN gate_report jsonb,
  ADD COLUMN reviewer_verdicts jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN protocol_metadata jsonb;

ALTER TABLE agents
  ADD COLUMN review_trust_score real;
