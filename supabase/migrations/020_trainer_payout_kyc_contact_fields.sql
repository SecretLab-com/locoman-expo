-- ============================================================================
-- TRAINER PAYOUT ONBOARDING CONTACT FIELDS
-- ============================================================================

ALTER TABLE trainer_payout_onboarding_details
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE trainer_payout_onboarding_details
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
