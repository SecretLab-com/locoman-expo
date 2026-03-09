-- Reschedule requests for session time changes (from Google Calendar sync or manual)
CREATE TABLE IF NOT EXISTS reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id),
  client_id UUID NOT NULL REFERENCES users(id),
  original_date TIMESTAMPTZ NOT NULL,
  proposed_date TIMESTAMPTZ NOT NULL,
  proposed_duration INTEGER,
  proposed_location TEXT,
  source TEXT DEFAULT 'google_calendar',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'counter_proposed')),
  counter_date TIMESTAMPTZ,
  note TEXT,
  response_note TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
