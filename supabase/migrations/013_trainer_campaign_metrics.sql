-- ============================================================================
-- TRAINER CAMPAIGN METRICS (Campaign-attributed daily facts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_campaign_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_draft_id UUID NOT NULL REFERENCES bundle_drafts(id) ON DELETE CASCADE,
  campaign_account_id UUID NOT NULL REFERENCES campaign_accounts(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  platform TEXT,
  followers BIGINT NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  engagements BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  share_saves BIGINT NOT NULL DEFAULT 0,
  posts_delivered INT NOT NULL DEFAULT 0,
  posts_on_time INT NOT NULL DEFAULT 0,
  required_posts INT NOT NULL DEFAULT 0,
  required_tag_posts INT NOT NULL DEFAULT 0,
  approved_creative_posts INT NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id, bundle_draft_id, campaign_account_id, metric_date, platform)
);

CREATE INDEX IF NOT EXISTS idx_trainer_campaign_metrics_bundle_date
  ON trainer_campaign_metrics_daily(bundle_draft_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_campaign_metrics_account_date
  ON trainer_campaign_metrics_daily(campaign_account_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_campaign_metrics_trainer_date
  ON trainer_campaign_metrics_daily(trainer_id, metric_date DESC);

CREATE TRIGGER trg_trainer_campaign_metrics_daily_updated_at
  BEFORE UPDATE ON trainer_campaign_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
