-- ============================================================================
-- PHYLLO REALTIME WEBHOOK EVENTS + SOCIAL NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS phyllo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phyllo_user_id TEXT,
  phyllo_account_id TEXT,
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'processed', 'failed', 'ignored')
  ),
  attempt_count INT NOT NULL DEFAULT 1,
  last_error TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phyllo_webhook_events_trainer
  ON phyllo_webhook_events(trainer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phyllo_webhook_events_type
  ON phyllo_webhook_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phyllo_webhook_events_status
  ON phyllo_webhook_events(status, created_at DESC);

CREATE TABLE IF NOT EXISTS social_event_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES phyllo_webhook_events(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL DEFAULT 'social_event',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_event_notifications_recipient
  ON social_event_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_event_notifications_read
  ON social_event_notifications(recipient_user_id, read_at, created_at DESC);

CREATE TRIGGER trg_phyllo_webhook_events_updated_at
  BEFORE UPDATE ON phyllo_webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_social_event_notifications_updated_at
  BEFORE UPDATE ON social_event_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime publication additions
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_social_profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_social_metrics_daily;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_campaign_metrics_daily;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE social_event_notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Row-level security for new realtime-facing tables
ALTER TABLE phyllo_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_event_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phyllo_webhook_events_select_policy ON phyllo_webhook_events;
CREATE POLICY phyllo_webhook_events_select_policy
  ON phyllo_webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = phyllo_webhook_events.trainer_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );

DROP POLICY IF EXISTS social_event_notifications_select_policy ON social_event_notifications;
CREATE POLICY social_event_notifications_select_policy
  ON social_event_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users self_user
      WHERE self_user.auth_id = auth.uid()
        AND self_user.id = social_event_notifications.recipient_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM users staff_user
      WHERE staff_user.auth_id = auth.uid()
        AND staff_user.role IN ('manager', 'coordinator')
    )
  );
