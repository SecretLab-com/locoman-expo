-- ============================================================================
-- CAMPAIGN POST ATTRIBUTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_social_content_campaign_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_social_content_id UUID NOT NULL REFERENCES trainer_social_contents(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_draft_id UUID NOT NULL REFERENCES bundle_drafts(id) ON DELETE CASCADE,
  campaign_account_id UUID NOT NULL REFERENCES campaign_accounts(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('matched', 'rejected', 'needs_review')),
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_social_content_id, bundle_draft_id, campaign_account_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_content_campaign_attr_trainer
  ON trainer_social_content_campaign_attributions(trainer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_social_content_campaign_attr_bundle
  ON trainer_social_content_campaign_attributions(bundle_draft_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_social_content_campaign_attr_account
  ON trainer_social_content_campaign_attributions(campaign_account_id, status, updated_at DESC);

CREATE TRIGGER trg_trainer_social_content_campaign_attr_updated_at
  BEFORE UPDATE ON trainer_social_content_campaign_attributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE trainer_social_content_campaign_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_social_content_campaign_attr_select_policy
  ON trainer_social_content_campaign_attributions;

CREATE POLICY trainer_social_content_campaign_attr_select_policy
  ON trainer_social_content_campaign_attributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_social_content_campaign_attributions.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );
