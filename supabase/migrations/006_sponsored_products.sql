-- Add sponsored product fields for brand partnerships and trainer bonuses
ALTER TABLE products ADD COLUMN IF NOT EXISTS trainer_bonus DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sponsored_by TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bonus_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE;

-- Add bonus tracking fields to bundle_drafts so the total bonus is visible
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS total_trainer_bonus DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN products.trainer_bonus IS 'Bonus amount paid to trainer per sale when this product is included in a bundle';
COMMENT ON COLUMN products.sponsored_by IS 'Brand name sponsoring this product bonus';
COMMENT ON COLUMN products.bonus_expires_at IS 'When the sponsored bonus offer expires';
COMMENT ON COLUMN products.is_sponsored IS 'Whether this product has an active brand sponsorship';
COMMENT ON COLUMN bundle_drafts.total_trainer_bonus IS 'Total trainer bonus from all sponsored products in this bundle';
