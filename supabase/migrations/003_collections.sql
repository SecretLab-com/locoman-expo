-- ============================================================================
-- SHOPIFY COLLECTIONS (synced from Shopify, not live-fetched)
-- ============================================================================

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_collection_id bigint UNIQUE NOT NULL,
  title varchar(255) NOT NULL,
  handle varchar(255) NOT NULL,
  image_url text,
  channels jsonb DEFAULT '[]'::jsonb,
  shop_enabled boolean DEFAULT false,
  product_ids jsonb DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_handle ON collections(handle);
CREATE INDEX idx_collections_shop_enabled ON collections(shop_enabled);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER set_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
