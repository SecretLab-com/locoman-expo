-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('shopper', 'client', 'trainer', 'manager', 'coordinator');
CREATE TYPE bundle_status AS ENUM ('draft', 'validating', 'ready', 'pending_review', 'changes_requested', 'pending_update', 'publishing', 'published', 'failed', 'rejected');
CREATE TYPE bundle_cadence AS ENUM ('one_time', 'weekly', 'monthly');
CREATE TYPE bundle_image_source AS ENUM ('ai', 'custom');
CREATE TYPE bundle_goal_type AS ENUM ('weight_loss', 'strength', 'longevity', 'power');
CREATE TYPE product_category AS ENUM ('protein', 'pre_workout', 'post_workout', 'recovery', 'strength', 'wellness', 'hydration', 'vitamins');
CREATE TYPE product_phase AS ENUM ('preworkout', 'postworkout', 'recovery');
CREATE TYPE product_availability AS ENUM ('available', 'out_of_stock', 'discontinued');
CREATE TYPE client_status AS ENUM ('pending', 'active', 'inactive', 'removed');
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'expired');
CREATE TYPE subscription_type AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE session_type AS ENUM ('training', 'check_in', 'call', 'plan_review');
CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE fulfillment_status AS ENUM ('unfulfilled', 'partial', 'fulfilled', 'restocked');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'partially_refunded');
CREATE TYPE fulfillment_method AS ENUM ('home_ship', 'trainer_delivery', 'vending', 'cafeteria');
CREATE TYPE delivery_status AS ENUM ('pending', 'ready', 'scheduled', 'out_for_delivery', 'delivered', 'confirmed', 'disputed', 'cancelled');
CREATE TYPE delivery_method AS ENUM ('in_person', 'locker', 'front_desk', 'shipped');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
CREATE TYPE earning_type AS ENUM ('bundle_sale', 'subscription', 'commission', 'bonus');
CREATE TYPE earning_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE user_action AS ENUM ('role_changed', 'status_changed', 'impersonation_started', 'impersonation_ended', 'profile_updated', 'invited', 'deleted');
CREATE TYPE payment_session_method AS ENUM ('qr', 'link', 'tap', 'card', 'apple_pay');
CREATE TYPE payment_session_status AS ENUM ('created', 'pending', 'authorised', 'captured', 'refused', 'cancelled', 'error', 'refunded');
CREATE TYPE calendar_event_type AS ENUM ('session', 'delivery', 'appointment', 'other');
CREATE TYPE order_item_fulfillment AS ENUM ('unfulfilled', 'fulfilled', 'restocked');

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to Supabase Auth user
  auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  open_id varchar(64) UNIQUE,
  name text,
  email varchar(320),
  phone varchar(20),
  photo_url text,
  login_method varchar(64),
  role user_role NOT NULL DEFAULT 'shopper',
  username varchar(64) UNIQUE,
  bio text,
  specialties jsonb,
  social_links jsonb,
  trainer_id uuid REFERENCES users(id),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_signed_in timestamptz NOT NULL DEFAULT now(),
  password_hash varchar(255)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- ============================================================================
-- BUNDLE TEMPLATES
-- ============================================================================

CREATE TABLE bundle_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  description text,
  goal_type bundle_goal_type,
  goals_json jsonb,
  image_url text,
  base_price decimal(10, 2),
  min_price decimal(10, 2),
  max_price decimal(10, 2),
  rules_json jsonb,
  default_services jsonb,
  default_products jsonb,
  active boolean NOT NULL DEFAULT true,
  usage_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- BUNDLE DRAFTS
-- ============================================================================

CREATE TABLE bundle_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id),
  template_id uuid REFERENCES bundle_templates(id),
  title varchar(255) NOT NULL,
  description text,
  image_url text,
  image_source bundle_image_source DEFAULT 'ai',
  price decimal(10, 2),
  cadence bundle_cadence DEFAULT 'one_time',
  selections_json jsonb,
  services_json jsonb,
  products_json jsonb,
  goals_json jsonb,
  suggested_goal varchar(100),
  status bundle_status NOT NULL DEFAULT 'draft',
  shopify_product_id bigint,
  shopify_variant_id bigint,
  view_count int DEFAULT 0,
  sales_count int DEFAULT 0,
  total_revenue decimal(10, 2) DEFAULT 0,
  submitted_for_review_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  rejection_reason text,
  review_comments text,
  version int DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bundle_drafts_trainer ON bundle_drafts(trainer_id);
CREATE INDEX idx_bundle_drafts_status ON bundle_drafts(status);
CREATE INDEX idx_bundle_drafts_shopify ON bundle_drafts(shopify_product_id);

-- ============================================================================
-- PRODUCTS
-- ============================================================================

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_product_id bigint UNIQUE,
  shopify_variant_id bigint,
  name varchar(255) NOT NULL,
  description text,
  image_url text,
  media jsonb,
  price decimal(10, 2) NOT NULL,
  compare_at_price decimal(10, 2),
  brand varchar(100),
  category product_category,
  phase product_phase,
  fulfillment_options jsonb,
  inventory_quantity int DEFAULT 0,
  availability product_availability DEFAULT 'available',
  is_approved boolean DEFAULT false,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_availability ON products(availability);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_shopify ON products(shopify_product_id);

-- ============================================================================
-- CLIENTS
-- ============================================================================

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id),
  user_id uuid REFERENCES users(id),
  name varchar(255) NOT NULL,
  email varchar(320),
  phone varchar(20),
  photo_url text,
  goals jsonb,
  notes text,
  status client_status DEFAULT 'pending',
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_trainer ON clients(trainer_id);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  trainer_id uuid NOT NULL REFERENCES users(id),
  bundle_draft_id uuid REFERENCES bundle_drafts(id),
  status subscription_status DEFAULT 'active',
  subscription_type subscription_type DEFAULT 'monthly',
  price decimal(10, 2) NOT NULL,
  start_date timestamptz NOT NULL,
  renewal_date timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  sessions_included int DEFAULT 0,
  sessions_used int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SESSIONS (training sessions)
-- ============================================================================

CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  trainer_id uuid NOT NULL REFERENCES users(id),
  subscription_id uuid REFERENCES subscriptions(id),
  session_date timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  session_type session_type DEFAULT 'training',
  location varchar(255),
  status session_status DEFAULT 'scheduled',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_trainer ON training_sessions(trainer_id);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id bigint,
  shopify_order_number varchar(64),
  client_id uuid REFERENCES users(id),
  trainer_id uuid REFERENCES users(id),
  customer_email varchar(320),
  customer_name varchar(255),
  total_amount decimal(10, 2) NOT NULL,
  subtotal_amount decimal(10, 2),
  tax_amount decimal(10, 2),
  shipping_amount decimal(10, 2),
  status order_status DEFAULT 'pending',
  fulfillment_status fulfillment_status DEFAULT 'unfulfilled',
  payment_status payment_status DEFAULT 'pending',
  fulfillment_method fulfillment_method DEFAULT 'home_ship',
  delivery_date timestamptz,
  delivered_at timestamptz,
  tracking_number varchar(255),
  order_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_id uuid REFERENCES products(id),
  name varchar(255) NOT NULL,
  quantity int NOT NULL,
  price decimal(10, 2) NOT NULL,
  total_price decimal(10, 2) NOT NULL,
  fulfillment_status order_item_fulfillment DEFAULT 'unfulfilled',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PRODUCT DELIVERIES
-- ============================================================================

CREATE TABLE product_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  order_item_id uuid REFERENCES order_items(id),
  trainer_id uuid NOT NULL REFERENCES users(id),
  client_id uuid NOT NULL REFERENCES users(id),
  product_id uuid REFERENCES products(id),
  product_name varchar(255) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  status delivery_status DEFAULT 'pending',
  scheduled_date timestamptz,
  delivered_at timestamptz,
  confirmed_at timestamptz,
  delivery_method delivery_method,
  tracking_number varchar(255),
  notes text,
  client_notes text,
  dispute_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliveries_trainer ON product_deliveries(trainer_id);
CREATE INDEX idx_deliveries_client ON product_deliveries(client_id);

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id),
  receiver_id uuid NOT NULL REFERENCES users(id),
  conversation_id varchar(64) NOT NULL,
  content text NOT NULL,
  message_type message_type DEFAULT 'text',
  attachment_url text,
  attachment_name varchar(255),
  attachment_size int,
  attachment_mime_type varchar(100),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================

CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id),
  user_id uuid NOT NULL REFERENCES users(id),
  reaction varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- CALENDAR EVENTS
-- ============================================================================

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  title varchar(255) NOT NULL,
  description text,
  location varchar(255),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  event_type calendar_event_type DEFAULT 'other',
  related_client_id uuid REFERENCES clients(id),
  related_order_id uuid REFERENCES orders(id),
  reminder_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TRAINER EARNINGS
-- ============================================================================

CREATE TABLE trainer_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id),
  order_id uuid REFERENCES orders(id),
  bundle_draft_id uuid REFERENCES bundle_drafts(id),
  subscription_id uuid REFERENCES subscriptions(id),
  earning_type earning_type DEFAULT 'bundle_sale',
  amount decimal(10, 2) NOT NULL,
  status earning_status DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_earnings_trainer ON trainer_earnings(trainer_id);

-- ============================================================================
-- ACTIVITY LOGS
-- ============================================================================

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action varchar(100) NOT NULL,
  entity_type varchar(50),
  entity_id uuid,
  details jsonb,
  ip_address varchar(45),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INVITATIONS (trainer invites client)
-- ============================================================================

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES users(id),
  email varchar(320) NOT NULL,
  name varchar(255),
  token varchar(64) NOT NULL UNIQUE,
  bundle_draft_id uuid REFERENCES bundle_drafts(id),
  status invitation_status DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- USER INVITATIONS (manager invites new users)
-- ============================================================================

CREATE TABLE user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL REFERENCES users(id),
  email varchar(320) NOT NULL,
  name varchar(255),
  role user_role NOT NULL DEFAULT 'shopper',
  token varchar(64) NOT NULL UNIQUE,
  status invitation_status DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- USER ACTIVITY LOGS
-- ============================================================================

CREATE TABLE user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id),
  performed_by uuid NOT NULL REFERENCES users(id),
  action user_action NOT NULL,
  previous_value varchar(100),
  new_value varchar(100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PAYMENT SESSIONS
-- ============================================================================

CREATE TABLE payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adyen_session_id varchar(255) UNIQUE,
  adyen_session_data text,
  merchant_reference varchar(128) NOT NULL UNIQUE,
  requested_by uuid NOT NULL REFERENCES users(id),
  payer_id uuid REFERENCES users(id),
  amount_minor int NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'GBP',
  description varchar(500),
  method payment_session_method,
  status payment_session_status NOT NULL DEFAULT 'created',
  psp_reference varchar(128),
  order_id uuid REFERENCES orders(id),
  subscription_id uuid REFERENCES subscriptions(id),
  payment_link text,
  metadata jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PAYMENT LOGS
-- ============================================================================

CREATE TABLE payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_session_id uuid REFERENCES payment_sessions(id),
  psp_reference varchar(128),
  merchant_reference varchar(128),
  event_code varchar(64) NOT NULL,
  success boolean NOT NULL DEFAULT false,
  amount_minor int,
  currency varchar(3),
  payment_method varchar(64),
  raw_payload jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bundle_templates_updated_at BEFORE UPDATE ON bundle_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bundle_drafts_updated_at BEFORE UPDATE ON bundle_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON product_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_calendar_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_earnings_updated_at BEFORE UPDATE ON trainer_earnings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payment_sessions_updated_at BEFORE UPDATE ON payment_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
