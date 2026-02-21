-- ============================================================================
-- BUNDLE TEMPLATE PROMOTION
-- Adds template-specific fields to bundle_drafts so a bundle can be
-- promoted to a template without a separate table.
-- ============================================================================

-- Allow coordinator/manager-created bundles (trainer_id is nullable for admin bundles)
ALTER TABLE bundle_drafts ALTER COLUMN trainer_id DROP NOT NULL;

-- Template promotion fields
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS template_visibility jsonb DEFAULT '[]'::jsonb;
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS discount_type varchar(20);
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS discount_value decimal(10,2);
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS availability_start timestamptz;
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS availability_end timestamptz;
ALTER TABLE bundle_drafts ADD COLUMN IF NOT EXISTS template_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_bundle_drafts_is_template ON bundle_drafts(is_template) WHERE is_template = true;
