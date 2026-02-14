-- ============================================================================
-- PARTNERSHIPS (trainer ad/affiliate partnerships)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partnership_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL UNIQUE,
  type varchar(100) NOT NULL,
  description text,
  commission_rate numeric(5, 2) NOT NULL DEFAULT 0,
  website text,
  contact_email varchar(320),
  is_available boolean NOT NULL DEFAULT true,
  status varchar(32) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'submitted', 'inactive')),
  submitted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partnership_businesses_status ON partnership_businesses(status);
CREATE INDEX IF NOT EXISTS idx_partnership_businesses_available ON partnership_businesses(is_available);

CREATE TABLE IF NOT EXISTS trainer_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id),
  business_id uuid NOT NULL REFERENCES partnership_businesses(id),
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
  commission_rate numeric(5, 2) NOT NULL DEFAULT 0,
  total_earnings numeric(10, 2) NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  conversion_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_partnerships_trainer ON trainer_partnerships(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_partnerships_business ON trainer_partnerships(business_id);
CREATE INDEX IF NOT EXISTS idx_trainer_partnerships_status ON trainer_partnerships(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_partnerships_unique_open
  ON trainer_partnerships(trainer_id, business_id)
  WHERE status IN ('pending', 'active');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partnership_businesses_updated_at') THEN
    CREATE TRIGGER trg_partnership_businesses_updated_at
      BEFORE UPDATE ON partnership_businesses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_trainer_partnerships_updated_at') THEN
    CREATE TRIGGER trg_trainer_partnerships_updated_at
      BEFORE UPDATE ON trainer_partnerships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

INSERT INTO partnership_businesses (name, type, description, commission_rate, is_available, status)
VALUES
  ('PowerLift Gym', 'Gym', 'Local gym chain with premium facilities', 20, true, 'available'),
  ('HealthyMeals Co', 'Meal Prep', 'Healthy meal prep delivery service', 12, true, 'available'),
  ('SportWear Plus', 'Apparel', 'Athletic wear and sportswear brand', 8, true, 'available')
ON CONFLICT (name) DO NOTHING;
