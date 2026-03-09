-- ============================================================================
-- CAMPAIGN SHARE LINKS
-- Adds public share link controls on promoted campaign bundles.
-- ============================================================================

ALTER TABLE bundle_drafts
  ADD COLUMN IF NOT EXISTS public_share_slug VARCHAR(160);

ALTER TABLE bundle_drafts
  ADD COLUMN IF NOT EXISTS public_share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_drafts_public_share_slug_unique
  ON bundle_drafts(public_share_slug)
  WHERE public_share_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bundle_drafts_public_share_enabled
  ON bundle_drafts(public_share_enabled)
  WHERE is_template = TRUE;
