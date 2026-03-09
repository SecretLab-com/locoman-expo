-- ============================================================================
-- TRAINER SOCIAL CONTENTS (Recent posts + activity sparkline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_social_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phyllo_user_id TEXT,
  phyllo_account_id TEXT,
  phyllo_content_id TEXT NOT NULL,
  platform TEXT,
  post_url TEXT,
  profile_url TEXT,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  published_at TIMESTAMPTZ,
  latest_views BIGINT NOT NULL DEFAULT 0,
  latest_likes BIGINT NOT NULL DEFAULT 0,
  latest_comments BIGINT NOT NULL DEFAULT 0,
  latest_engagements BIGINT NOT NULL DEFAULT 0,
  metadata JSONB,
  raw_payload JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id, phyllo_content_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_contents_trainer_published
  ON trainer_social_contents(trainer_id, published_at DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_social_contents_platform
  ON trainer_social_contents(trainer_id, platform, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS trainer_social_content_activity_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_social_content_id UUID NOT NULL REFERENCES trainer_social_contents(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  engagements BIGINT NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_social_content_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_content_activity_daily_content_date
  ON trainer_social_content_activity_daily(trainer_social_content_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_social_content_activity_daily_trainer_date
  ON trainer_social_content_activity_daily(trainer_id, metric_date DESC);

CREATE TRIGGER trg_trainer_social_contents_updated_at
  BEFORE UPDATE ON trainer_social_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trainer_social_content_activity_daily_updated_at
  BEFORE UPDATE ON trainer_social_content_activity_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime publication additions
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_social_contents;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_social_content_activity_daily;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- RLS
ALTER TABLE trainer_social_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_social_content_activity_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_social_contents_select_policy ON trainer_social_contents;
CREATE POLICY trainer_social_contents_select_policy
  ON trainer_social_contents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_social_contents.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );

DROP POLICY IF EXISTS trainer_social_content_activity_daily_select_policy ON trainer_social_content_activity_daily;
CREATE POLICY trainer_social_content_activity_daily_select_policy
  ON trainer_social_content_activity_daily
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = trainer_social_content_activity_daily.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );
