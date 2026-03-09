ALTER TABLE trainer_social_memberships
  DROP CONSTRAINT IF EXISTS trainer_social_memberships_status_check;

ALTER TABLE trainer_social_memberships
  ADD CONSTRAINT trainer_social_memberships_status_check
  CHECK (status IN ('invited', 'active', 'paused', 'banned', 'declined', 'uninvited'));
