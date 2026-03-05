-- ============================================================================
-- CAMPAIGN ACCOUNTS (Brand / Customer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL DEFAULT 'brand' CHECK (account_type IN ('brand', 'customer')),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  website_url TEXT,
  contact_name VARCHAR(255),
  contact_email VARCHAR(320),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_accounts_type_active
  ON campaign_accounts(account_type, active);

CREATE INDEX IF NOT EXISTS idx_campaign_accounts_name
  ON campaign_accounts(name);

-- Link many accounts to a promoted template (stored in bundle_drafts where is_template=true)
CREATE TABLE IF NOT EXISTS campaign_template_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_bundle_id UUID NOT NULL REFERENCES bundle_drafts(id) ON DELETE CASCADE,
  campaign_account_id UUID NOT NULL REFERENCES campaign_accounts(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'brand' CHECK (relation_type IN ('brand', 'customer', 'partner')),
  allocation_pct NUMERIC(6,2),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_bundle_id, campaign_account_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_template_accounts_template
  ON campaign_template_accounts(template_bundle_id);

CREATE INDEX IF NOT EXISTS idx_campaign_template_accounts_account
  ON campaign_template_accounts(campaign_account_id);

-- Snapshot links copied to actual campaign offers/bundles derived from templates.
CREATE TABLE IF NOT EXISTS bundle_campaign_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_draft_id UUID NOT NULL REFERENCES bundle_drafts(id) ON DELETE CASCADE,
  campaign_account_id UUID NOT NULL REFERENCES campaign_accounts(id) ON DELETE CASCADE,
  source_template_bundle_id UUID REFERENCES bundle_drafts(id) ON DELETE SET NULL,
  relation_type TEXT NOT NULL DEFAULT 'brand' CHECK (relation_type IN ('brand', 'customer', 'partner')),
  allocation_pct NUMERIC(6,2),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bundle_draft_id, campaign_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_campaign_accounts_bundle
  ON bundle_campaign_accounts(bundle_draft_id);

CREATE INDEX IF NOT EXISTS idx_bundle_campaign_accounts_account
  ON bundle_campaign_accounts(campaign_account_id);

CREATE TRIGGER trg_campaign_accounts_updated_at
  BEFORE UPDATE ON campaign_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_campaign_template_accounts_updated_at
  BEFORE UPDATE ON campaign_template_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bundle_campaign_accounts_updated_at
  BEFORE UPDATE ON bundle_campaign_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
