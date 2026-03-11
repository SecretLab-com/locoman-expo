-- ============================================================================
-- TRAINER CUSTOM PRODUCTS
-- ============================================================================

create table trainer_custom_products (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  name varchar(255) not null,
  description text,
  image_url text,
  price decimal(10, 2) not null,
  fulfillment_method fulfillment_method not null default 'trainer_delivery',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_trainer_custom_products_trainer on trainer_custom_products(trainer_id);
create index idx_trainer_custom_products_active on trainer_custom_products(active);

alter table product_deliveries
  add column if not exists custom_product_id uuid references trainer_custom_products(id) on delete set null,
  add column if not exists product_image_url text,
  add column if not exists unit_price decimal(10, 2);
