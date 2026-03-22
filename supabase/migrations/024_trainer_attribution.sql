-- Trainer attribution: tracks which trainer is credited for a customer's purchases.
-- Uses a "current attribution" table for fast lookups and a log table for audit/history.

CREATE TYPE attribution_source AS ENUM (
  'store_link',
  'invitation_acceptance',
  'bundle_purchase',
  'manual'
);

CREATE TABLE trainer_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source attribution_source NOT NULL DEFAULT 'store_link',
  attributed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  UNIQUE (customer_id)
);

CREATE INDEX idx_trainer_attributions_trainer ON trainer_attributions(trainer_id);
CREATE INDEX idx_trainer_attributions_customer ON trainer_attributions(customer_id);

CREATE TABLE trainer_attribution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source attribution_source NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX idx_trainer_attribution_log_customer ON trainer_attribution_log(customer_id);
CREATE INDEX idx_trainer_attribution_log_trainer ON trainer_attribution_log(trainer_id);

COMMENT ON TABLE trainer_attributions IS 'Current trainer attribution per customer (latest interaction wins)';
COMMENT ON TABLE trainer_attribution_log IS 'Append-only audit trail of attribution changes';

-- Per-product and per-bundle commission rate overrides (default 10% when null)
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN products.commission_rate IS 'Override commission rate for this product (percent, e.g. 10.00 = 10%). NULL means use default 10%.';
COMMENT ON COLUMN bundle_drafts.commission_rate IS 'Override commission rate for this bundle (percent). NULL means use default 10%.';

-- Add attribution_id to orders for traceability
ALTER TABLE orders ADD COLUMN IF NOT EXISTS attribution_id uuid REFERENCES trainer_attributions(id);
