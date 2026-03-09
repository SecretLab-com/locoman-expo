# Sponsored Bundles & Trainer Bonuses — PRD

## Overview

Brands can sponsor products with trainer bonuses. When a trainer includes sponsored products in their bundles and sells them, they earn bonus payments on top of their regular commission. This incentivizes trainers to promote quality products while increasing their income.

## Workflow

### 1. Coordinator Creates a Sponsored Product

A coordinator or manager marks a product as sponsored:

- **`is_sponsored`**: true
- **`sponsored_by`**: Brand name (e.g., "Optimum Nutrition")
- **`trainer_bonus`**: Dollar amount per sale (e.g., $5.00)
- **`bonus_expires_at`**: Optional expiry date for the sponsorship deal

Products are managed in the Products section and synced from Shopify. Sponsorship fields are set independently.

### 2. Coordinator Creates a Bundle Template

A coordinator creates a bundle containing sponsored products and promotes it to a template:

1. Create a bundle with sponsored products included
2. Promote to template via `admin.promoteBundleToTemplate`
3. Set template visibility, discount, and availability window
4. The `total_trainer_bonus` is automatically calculated from the sponsored products

### 3. Trainer Browses Templates

When a trainer browses templates to create a new bundle:

- Templates display their **total trainer bonus** prominently
- Bonus value = sum of all sponsored product bonuses × quantities
- Expired bonuses are excluded from the calculation
- Trainers can see which products carry bonuses and the sponsoring brand

Example display:
```
┌─────────────────────────────────────────┐
│ 💪 Starter Fitness Bundle              │
│ Price: $49.99                           │
│ Sponsored by: Optimum Nutrition         │
│ 🎁 Trainer Bonus: $12.00 per sale      │
│                                         │
│ Products:                               │
│  • Whey Protein (sponsored: +$5.00)     │
│  • Pre-Workout (sponsored: +$3.50)      │
│  • Shaker Bottle                        │
│  • Recovery Bar x2 (sponsored: +$3.50)  │
└─────────────────────────────────────────┘
```

### 4. Trainer Customizes and Submits

1. Trainer selects a template
2. Modifies contents (add/remove products, change pricing, update description)
3. The total trainer bonus recalculates based on their final product selection
4. Trainer submits bundle for approval (`pending_review`)

### 5. Coordinator Approves

1. Coordinator reviews the bundle in the pending approvals queue
2. Verifies products, pricing, and bonus eligibility
3. Approves → status changes to `published`
4. Trainer gets a push notification

### 6. Trainer Invites Clients

1. Trainer invites clients to the published bundle
2. Client accepts and places an order
3. Order is created with all products

### 7. Bonus Payout

When an order is placed with sponsored products:

1. System checks each product in the order for active sponsorship
2. For each sponsored product with a valid (non-expired) bonus:
   - Creates a `trainer_earning` record with `earning_type = 'bonus'`
   - Amount = `trainer_bonus × quantity`
   - Notes include product name, brand, and quantity
3. Bonus earnings appear in the trainer's earnings dashboard
4. Bonuses are paid out alongside regular commissions

## Data Model

### Product (extended fields)

| Field | Type | Description |
|-------|------|-------------|
| `trainer_bonus` | decimal(10,2) | Bonus amount per sale |
| `sponsored_by` | text | Brand name |
| `bonus_expires_at` | timestamptz | When the bonus offer expires |
| `is_sponsored` | boolean | Whether product has active sponsorship |

### Bundle Draft (extended field)

| Field | Type | Description |
|-------|------|-------------|
| `total_trainer_bonus` | decimal(10,2) | Calculated total bonus from all sponsored products |

### Trainer Earning (existing, used for bonuses)

| Field | Value |
|-------|-------|
| `earning_type` | `'bonus'` |
| `amount` | Total bonus for this product × quantity |
| `notes` | "Sponsored product bonus: {product} ({brand}) x{qty}" |
| `status` | `'pending'` → `'approved'` → `'paid'` |

## Status Flow

```
Coordinator creates template with sponsored products
        ↓
Trainer browses templates (sees bonus values)
        ↓
Trainer selects template → customizes → submits
        ↓
Coordinator approves → published
        ↓
Trainer invites clients
        ↓
Client purchases → order created
        ↓
System creates bonus earnings for sponsored products
        ↓
Trainer sees bonus in earnings dashboard
        ↓
Bonus paid out via regular payout cycle
```

## Bonus Expiry

- `bonus_expires_at` is checked at two points:
  1. **Template display**: Expired bonuses are excluded from `total_trainer_bonus`
  2. **Order processing**: Expired bonuses are NOT created as earnings
- When a brand sponsorship expires, the product remains in bundles but no longer generates trainer bonuses
- Coordinators can update or extend expiry dates at any time

## API Endpoints

### Existing (updated)

- `bundles.templates` — Now includes `totalTrainerBonus` for each template
- `catalog.products` — Now returns sponsored product fields
- `earnings.list` — Already shows bonus-type earnings
- `earnings.summary` — Already includes bonuses in totals

### Product Management (coordinator)

Products are managed via the existing admin interface. Sponsored fields can be set when editing a product.

## MCP Tools

The following MCP tools support this workflow:

| Tool | Role in Workflow |
|------|-----------------|
| `list_bundles` | See bundles with bonus info |
| `list_clients` | Find clients to invite |
| `recommend_bundles_from_chats` | Match clients to sponsored bundles |
| `invite_client` | Send bundle invitation |
| `bulk_invite_clients_to_bundle` | Send to multiple clients |
| `client_value_report` | Track bonus revenue |
