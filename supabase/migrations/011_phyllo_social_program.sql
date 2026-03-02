-- ============================================================================
-- PHYLLO SOCIAL PROGRAM
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_social_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'paused', 'banned', 'declined')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  banned_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_memberships_status
  ON trainer_social_memberships(status);

CREATE TABLE IF NOT EXISTS trainer_social_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  membership_id UUID REFERENCES trainer_social_memberships(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  summary TEXT,
  sent_in_app BOOLEAN NOT NULL DEFAULT FALSE,
  sent_message BOOLEAN NOT NULL DEFAULT FALSE,
  sent_email BOOLEAN NOT NULL DEFAULT FALSE,
  message_conversation_id TEXT,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  email_message_id TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_invites_trainer
  ON trainer_social_invites(trainer_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS trainer_social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phyllo_user_id TEXT,
  phyllo_account_ids JSONB,
  platforms JSONB,
  follower_count BIGINT NOT NULL DEFAULT 0,
  avg_views_per_month BIGINT NOT NULL DEFAULT 0,
  avg_engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  metadata JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id)
);

CREATE TABLE IF NOT EXISTS trainer_social_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES trainer_social_profiles(id) ON DELETE SET NULL,
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
  UNIQUE (trainer_id, metric_date, platform)
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_metrics_daily_trainer_date
  ON trainer_social_metrics_daily(trainer_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS trainer_social_campaign_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minimum_followers INT NOT NULL DEFAULT 10000,
  minimum_posts INT NOT NULL DEFAULT 0,
  minimum_on_time_pct NUMERIC(5,2) NOT NULL DEFAULT 95,
  minimum_tag_pct NUMERIC(5,2) NOT NULL DEFAULT 98,
  minimum_approved_creative_pct NUMERIC(5,2) NOT NULL DEFAULT 98,
  minimum_avg_views INT NOT NULL DEFAULT 1000,
  minimum_engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0.03,
  minimum_ctr NUMERIC(8,4) NOT NULL DEFAULT 0.008,
  minimum_share_save_rate NUMERIC(8,4) NOT NULL DEFAULT 0.007,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_commitments_trainer
  ON trainer_social_campaign_commitments(trainer_id, active, effective_from DESC);

CREATE TABLE IF NOT EXISTS trainer_social_commitment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES trainer_social_campaign_commitments(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'watch', 'breach', 'paused', 'banned')),
  posts_delivered INT NOT NULL DEFAULT 0,
  posts_required INT NOT NULL DEFAULT 0,
  on_time_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  tag_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  approved_creative_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_views BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  share_save_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS trainer_social_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES trainer_social_campaign_commitments(id) ON DELETE SET NULL,
  metric_date DATE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  message TEXT NOT NULL,
  evidence JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_social_violations_status
  ON trainer_social_violations(status, created_at DESC);
