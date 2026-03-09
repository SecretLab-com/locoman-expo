-- ============================================================================
-- TRAINER PAYOUT ONBOARDING / KYC
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_payout_onboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_type TEXT CHECK (
    account_holder_type IN ('organization', 'individual')
  ),
  status TEXT NOT NULL DEFAULT 'start_setup' CHECK (
    status IN (
      'start_setup',
      'details_submitted',
      'verification_required',
      'under_review',
      'more_information_required',
      'active',
      'verification_failed',
      'account_rejected'
    )
  ),
  submitted_at TIMESTAMPTZ,
  kyc_link_sent_at TIMESTAMPTZ,
  kyc_started_at TIMESTAMPTZ,
  kyc_submitted_at TIMESTAMPTZ,
  under_review_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  active_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  additional_info_required_at TIMESTAMPTZ,
  adyen_account_holder_id TEXT,
  adyen_legal_entity_id TEXT,
  current_step_note TEXT,
  blocking_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_payout_onboardings_status
  ON trainer_payout_onboardings(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_payout_onboardings_trainer
  ON trainer_payout_onboardings(trainer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trainer_payout_onboarding_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES trainer_payout_onboardings(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_name TEXT,
  country_of_registration TEXT,
  first_name TEXT,
  last_name TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (onboarding_id),
  UNIQUE (trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_payout_onboarding_details_trainer
  ON trainer_payout_onboarding_details(trainer_id);

CREATE TABLE IF NOT EXISTS trainer_payout_onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES trainer_payout_onboardings(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'note' CHECK (
    event_type IN ('submitted', 'details_updated', 'status_changed', 'note', 'legacy_migrated')
  ),
  previous_status TEXT,
  next_status TEXT,
  note TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_payout_onboarding_events_onboarding
  ON trainer_payout_onboarding_events(onboarding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_payout_onboarding_events_trainer
  ON trainer_payout_onboarding_events(trainer_id, created_at DESC);

CREATE TRIGGER trg_trainer_payout_onboardings_updated_at
  BEFORE UPDATE ON trainer_payout_onboardings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trainer_payout_onboarding_details_updated_at
  BEFORE UPDATE ON trainer_payout_onboarding_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_payout_onboardings;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_payout_onboarding_details;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_payout_onboarding_events;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

ALTER TABLE trainer_payout_onboardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payout_onboarding_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payout_onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_payout_onboardings_select_policy
  ON trainer_payout_onboardings;
CREATE POLICY trainer_payout_onboardings_select_policy
  ON trainer_payout_onboardings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_payout_onboardings.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );

DROP POLICY IF EXISTS trainer_payout_onboarding_details_select_policy
  ON trainer_payout_onboarding_details;
CREATE POLICY trainer_payout_onboarding_details_select_policy
  ON trainer_payout_onboarding_details
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_payout_onboarding_details.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );

DROP POLICY IF EXISTS trainer_payout_onboarding_events_select_policy
  ON trainer_payout_onboarding_events;
CREATE POLICY trainer_payout_onboarding_events_select_policy
  ON trainer_payout_onboarding_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_payout_onboarding_events.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );
