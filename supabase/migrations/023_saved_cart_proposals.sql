-- ============================================================================
-- SAVED CART PROPOSALS
-- Customer-specific trainer proposals built from bundles/products/custom items.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'saved_cart_proposal_status'
  ) THEN
    CREATE TYPE saved_cart_proposal_status AS ENUM (
      'draft',
      'invited',
      'viewed',
      'purchased',
      'cancelled',
      'expired'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'saved_cart_item_type'
  ) THEN
    CREATE TYPE saved_cart_item_type AS ENUM (
      'bundle',
      'product',
      'custom_product',
      'service'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS saved_cart_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_record_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  client_email varchar(320),
  client_name varchar(255),
  base_bundle_draft_id uuid REFERENCES bundle_drafts(id) ON DELETE SET NULL,
  title varchar(255),
  notes text,
  assistant_prompt text,
  source varchar(32) NOT NULL DEFAULT 'manual',
  status saved_cart_proposal_status NOT NULL DEFAULT 'draft',
  start_date timestamptz,
  cadence_code varchar(32) NOT NULL DEFAULT 'weekly',
  sessions_per_week int NOT NULL DEFAULT 1,
  time_preference varchar(64),
  projected_schedule_json jsonb,
  projected_delivery_json jsonb,
  subtotal_amount decimal(10, 2) NOT NULL DEFAULT 0,
  discount_amount decimal(10, 2) NOT NULL DEFAULT 0,
  total_amount decimal(10, 2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'GBP',
  metadata jsonb,
  invited_at timestamptz,
  viewed_at timestamptz,
  purchased_at timestamptz,
  accepted_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_cart_proposals_trainer
  ON saved_cart_proposals(trainer_id);

CREATE INDEX IF NOT EXISTS idx_saved_cart_proposals_client_record
  ON saved_cart_proposals(client_record_id);

CREATE INDEX IF NOT EXISTS idx_saved_cart_proposals_status
  ON saved_cart_proposals(status);

CREATE TABLE IF NOT EXISTS saved_cart_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES saved_cart_proposals(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  item_type saved_cart_item_type NOT NULL,
  bundle_draft_id uuid REFERENCES bundle_drafts(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  custom_product_id uuid REFERENCES trainer_custom_products(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  description text,
  image_url text,
  quantity int NOT NULL DEFAULT 1,
  unit_price decimal(10, 2) NOT NULL DEFAULT 0,
  fulfillment_method fulfillment_method DEFAULT 'trainer_delivery',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_cart_proposal_items_proposal
  ON saved_cart_proposal_items(proposal_id);

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS saved_cart_proposal_id uuid REFERENCES saved_cart_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personal_message text,
  ADD COLUMN IF NOT EXISTS proposal_snapshot_json jsonb;

CREATE INDEX IF NOT EXISTS idx_invitations_saved_cart_proposal
  ON invitations(saved_cart_proposal_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS saved_cart_proposal_id uuid REFERENCES saved_cart_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS cart_diff_json jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_saved_cart_proposal
  ON orders(saved_cart_proposal_id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS bundle_draft_id uuid REFERENCES bundle_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_product_id uuid REFERENCES trainer_custom_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type varchar(32) NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_order_items_bundle_draft
  ON order_items(bundle_draft_id);

CREATE INDEX IF NOT EXISTS idx_order_items_custom_product
  ON order_items(custom_product_id);
