# LocoMotivate Product Requirements Document (PRD)

## Overview

LocoMotivate is a fitness bundle platform that connects trainers with clients through curated product and service bundles. Trainers create personalized bundles combining supplements, equipment, and coaching services, which are then sold through Shopify integration.

---

## Core Features

### 1. User Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Shopper** | Anonymous or logged-in browser | Browse catalog, view bundles, add to cart |
| **Client** | Purchased customer | Access purchased bundles, track orders, view trainer content |
| **Trainer** | Fitness professional | Create/edit bundles, manage clients, track sales |
| **Manager/Admin** | Platform administrator | Approve trainers, manage templates, view analytics, approve bundles |
| **Coordinator** | Operations staff | Handle fulfillment, customer support |

### 2. Bundle System

Bundles are the core product offering, combining:
- **Products**: Physical items (supplements, equipment) from Shopify
- **Services**: Digital offerings (coaching calls, meal plans, workout programs)

#### Bundle Lifecycle
1. **Draft**: Trainer creates and configures bundle
2. **Pending Approval**: Submitted for admin review
3. **Approved**: Admin approved, ready to publish
4. **Rejected**: Admin rejected with feedback
5. **Validating**: System checks product availability and pricing
6. **Ready**: Bundle passes validation, ready to publish
7. **Publishing**: Being synced to Shopify
8. **Published**: Live and available for purchase

### 3. Shopify Integration

- Products synced from Shopify store to local database for fast catalog loading
- Bundles published as Shopify products using Fixed Bundle API
- Orders tracked via webhooks (orders/create, orders/paid, orders/fulfilled)
- Inventory managed automatically by Shopify for bundles

---

## Feature: Trainer Landing Pages

### Overview

Each trainer has a dedicated public landing page that showcases their profile, expertise, and published bundles. This page serves as the trainer's storefront and is the primary entry point for their customers.

### User Stories

> As a trainer, I want a personalized landing page so that I can share a professional link with potential clients and build my brand.

> As a customer, I want to browse a specific trainer's offerings so that I can purchase bundles from someone I trust.

### URL Structure

| Pattern | Description | Example |
|---------|-------------|---------|
| `/t/{username}` | Trainer landing page by username | `/t/jason-fitness` |
| `/t/{trainerId}` | Fallback by trainer ID | `/t/12345` |

### Landing Page Components

1. **Hero Section**
   - Trainer profile photo
   - Display name and title
   - Bio/tagline
   - Social links (optional)

2. **Published Bundles Grid**
   - Only shows bundles with status "published"
   - Cover images, titles, prices
   - Click to view bundle detail

3. **Contact/Invite CTA**
   - "Work with [Trainer Name]" button
   - Links to invitation request form

### Technical Implementation

```typescript
// New tRPC route
trainers.getPublicProfile: publicProcedure
  .input(z.object({ 
    username: z.string().optional(),
    trainerId: z.number().optional()
  }))
  .query(async ({ input }) => {
    // Returns public trainer info + published bundles
  })
```

---

## Feature: Customer Isolation

### Overview

Trainers operate in isolated environments where they can only see and manage their own customers. This prevents trainers from "poaching" customers from other trainers and maintains trust in the platform.

### User Stories

> As a trainer, I want to see only my customers so that I can focus on my business without distraction.

> As an admin, I want to see all customers across all trainers so that I can manage the platform effectively.

### Isolation Rules

| Actor | Can See | Cannot See |
|-------|---------|------------|
| Trainer | Own invited/purchased clients | Other trainers' clients |
| Admin | All clients across all trainers | N/A (full visibility) |
| Client | Their own data | Other clients' data |

### Database Schema Changes

```sql
-- Add trainer ownership to clients table
ALTER TABLE clients ADD COLUMN trainer_id INTEGER REFERENCES users(id);
ALTER TABLE clients ADD COLUMN invited_at TIMESTAMP;
ALTER TABLE clients ADD COLUMN invitation_token TEXT;

-- Index for efficient trainer-scoped queries
CREATE INDEX idx_clients_trainer_id ON clients(trainer_id);
```

### Query Patterns

```typescript
// Trainer sees only their clients
const clients = await db.query.clients.findMany({
  where: eq(clients.trainerId, ctx.user.id)
});

// Admin sees all clients
const allClients = await db.query.clients.findMany({
  with: { trainer: true }
});
```

---

## Feature: Email Invitation System

### Overview

Trainers can invite potential customers via email. When a customer accepts an invitation, they are automatically linked to that trainer, establishing the trainer-customer relationship.

### User Stories

> As a trainer, I want to invite customers by email so that I can grow my client base.

> As a customer, I want to receive a personalized invitation so that I know which trainer I'm working with.

### Invitation Flow

```
1. Trainer enters customer email
2. System generates unique invitation token
3. Email sent with personalized link: /invite/{token}
4. Customer clicks link → lands on trainer's page
5. Customer signs up/logs in → linked to trainer
6. Trainer sees new customer in their dashboard
```

### Invitation States

| Status | Description |
|--------|-------------|
| `pending` | Email sent, awaiting response |
| `accepted` | Customer clicked link and signed up |
| `expired` | Token expired (7 days default) |
| `revoked` | Trainer cancelled invitation |

### Database Schema

```sql
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  trainer_id INTEGER NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_trainer ON invitations(trainer_id);
```

### API Endpoints

```typescript
// Send invitation
invitations.send: trainerProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input, ctx }) => {
    // Create invitation, send email
  })

// Accept invitation (public)
invitations.accept: publicProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    // Validate token, link customer to trainer
  })

// List trainer's invitations
invitations.list: trainerProcedure
  .query(async ({ ctx }) => {
    // Return trainer's sent invitations
  })
```

### Email Template

```
Subject: {TrainerName} invites you to LocoMotivate

Hi there!

{TrainerName} has invited you to join their fitness program on LocoMotivate.

Click below to view their personalized bundles and get started:

[View {TrainerName}'s Page]

This invitation expires in 7 days.

---
LocoMotivate - Your Fitness Journey Starts Here
```

---

## Feature: Bundle Approval Workflow

### Overview

All trainer-submitted bundles require admin approval before they can be published. This human-in-the-loop process ensures quality control and prevents inappropriate content from reaching customers.

### User Stories

> As an admin, I want to review and approve bundles before they go live so that I can maintain platform quality.

> As a trainer, I want to know the status of my bundle submission so that I can plan my marketing.

### Approval States

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `draft` | Trainer editing | Submit for approval |
| `pending_approval` | Awaiting admin review | Admin: Approve/Reject |
| `approved` | Admin approved | Trainer: Publish |
| `rejected` | Admin rejected | Trainer: Edit and resubmit |
| `published` | Live on platform | N/A |

### Database Schema Changes

```sql
ALTER TABLE bundle_drafts ADD COLUMN approval_status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE bundle_drafts ADD COLUMN submitted_at TIMESTAMP;
ALTER TABLE bundle_drafts ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE bundle_drafts ADD COLUMN reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE bundle_drafts ADD COLUMN rejection_reason TEXT;
```

### Admin Approval Queue

The admin dashboard includes a dedicated approval queue showing:
- All bundles with status `pending_approval`
- Trainer name and submission date
- Bundle preview (title, products, services, cover image)
- Approve/Reject buttons with optional feedback

### API Endpoints

```typescript
// Submit bundle for approval
bundles.submitForApproval: trainerProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Change status to pending_approval
  })

// Admin: Approve bundle
bundles.approve: adminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Change status to approved
  })

// Admin: Reject bundle
bundles.reject: adminProcedure
  .input(z.object({ 
    id: z.number(),
    reason: z.string()
  }))
  .mutation(async ({ input, ctx }) => {
    // Change status to rejected, store reason
  })

// Admin: Get all bundles (all statuses)
bundles.adminList: adminProcedure
  .query(async () => {
    // Return all bundles with trainer info
  })
```

### Notification Flow

1. **Trainer submits** → Admin receives notification
2. **Admin approves** → Trainer receives "Bundle Approved" notification
3. **Admin rejects** → Trainer receives "Bundle Rejected" with reason

---

## Feature: Trainer Discovery System

### Overview

Customers who are not yet connected to a trainer can browse a directory of all active trainers on the platform. This Instacart-style discovery system allows customers to find trainers that match their fitness goals and request to join their client roster.

### User Stories

> As a new customer, I want to browse all available trainers so that I can find one that matches my fitness goals.

> As a customer, I want to request to join a trainer's client list so that I can start working with them.

> As a trainer, I want to review and approve customer join requests so that I can control who becomes my client.

### Trainer Directory Page

**URL**: `/trainers`

**Components**:
1. **Search & Filter Bar**
   - Search by trainer name
   - Filter by specialty (strength, weight loss, longevity, etc.)

2. **Trainer Cards Grid**
   - Profile photo
   - Display name
   - Bio excerpt
   - Specialties badges
   - Bundle count
   - Client count
   - "View Profile" button
   - "Request to Join" button

3. **Pagination**
   - Load more or infinite scroll

### Join Request Flow

```
1. Customer browses trainer directory
2. Customer clicks "Request to Join" on trainer card
3. System creates join request with status "pending"
4. Trainer sees new request in their Clients tab
5. Trainer approves or rejects request
6. If approved: Customer linked to trainer, added to client list
7. If rejected: Customer notified, can request different trainer
```

### Join Request States

| Status | Description |
|--------|-------------|
| `pending` | Request submitted, awaiting trainer response |
| `approved` | Trainer accepted, customer linked |
| `rejected` | Trainer declined request |

### Database Schema

```sql
CREATE TABLE join_requests (
  id SERIAL PRIMARY KEY,
  trainer_id INTEGER NOT NULL REFERENCES users(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  UNIQUE(trainer_id, user_id)
);

CREATE INDEX idx_join_requests_trainer ON join_requests(trainer_id);
CREATE INDEX idx_join_requests_user ON join_requests(user_id);
```

### API Endpoints

```typescript
// Get trainer directory (public)
trainers.directory: publicProcedure
  .input(z.object({ 
    search: z.string().optional(),
    specialty: z.string().optional()
  }))
  .query(async ({ input }) => {
    // Return active trainers with bundle/client counts
  })

// Request to join trainer
joinRequests.create: protectedProcedure
  .input(z.object({ 
    trainerId: z.number(),
    message: z.string().optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Create join request
  })

// Trainer: Get pending join requests
joinRequests.pending: trainerProcedure
  .query(async ({ ctx }) => {
    // Return pending requests for this trainer
  })

// Trainer: Approve/reject request
joinRequests.respond: trainerProcedure
  .input(z.object({ 
    requestId: z.number(),
    approved: z.boolean()
  }))
  .mutation(async ({ input, ctx }) => {
    // Update request status, link customer if approved
  })
```

### Home Page Integration

A "Find a Trainer" section is added to the home page with:
- Brief description of trainer discovery
- "Browse Trainers" CTA button
- Links to `/trainers` directory

---

## Feature: Admin Oversight Dashboard

### Overview

The admin has full visibility into all platform activity, including all trainers, all customers, and all bundles regardless of status or ownership.

### Admin Capabilities

| Area | Capabilities |
|------|--------------|
| **Trainers** | View all, approve/suspend, view performance |
| **Customers** | View all across trainers, see which trainer owns each |
| **Bundles** | View all statuses, approve/reject, force unpublish |
| **Analytics** | Platform-wide metrics, revenue, growth |

### Admin Dashboard Sections

1. **Overview Cards**
   - Total trainers (active/pending)
   - Total customers
   - Total bundles by status
   - Revenue metrics

2. **Pending Approvals**
   - Trainer applications
   - Bundle submissions
   - Quick approve/reject actions

3. **All Bundles View**
   - Filterable by status, trainer, date
   - Bulk actions (approve multiple)
   - Search by title/trainer

4. **All Customers View**
   - Grouped by trainer
   - Invitation status
   - Purchase history

### API Endpoints

```typescript
// Admin: Get all trainers with stats
admin.trainers: adminProcedure
  .query(async () => {
    // Return all trainers with customer count, bundle count, revenue
  })

// Admin: Get all customers
admin.customers: adminProcedure
  .query(async () => {
    // Return all customers with trainer info
  })

// Admin: Get platform analytics
admin.analytics: adminProcedure
  .query(async () => {
    // Return platform-wide metrics
  })
```

---

## Feature: Automatic Bundle Cover Image Generation

### Overview

When a trainer creates or updates a bundle, the system automatically generates a professional cover image using AI. This ensures every bundle has an attractive, consistent visual presentation without requiring trainers to have design skills.

### User Story

> As a trainer, I want my bundles to automatically have professional cover images so that my offerings look polished and attract more clients without me needing to create graphics manually.

### Technical Implementation

#### Image Generation Prompt

The system generates bundle cover images using the following prompt template:

```
Create a pixel-perfect product photography composition on a deep black background 
with dramatic studio lighting. Arrange the following fitness products in an 
elegant, professional layout: {product_names}. 

Style: High-end commercial photography with soft shadows, rim lighting, and 
subtle reflections. The composition should feel premium, aspirational, and 
fitness-focused. Clean, minimal aesthetic with products as the hero elements.
```

#### Prompt Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{product_names}` | Bundle's productsJson | "protein powder, resistance bands, shaker bottle" |
| `{bundle_title}` | Bundle title | "Strength Starter Pack" |
| `{goal_type}` | Template goal type | "strength", "weight_loss", "longevity" |

#### Generation Triggers

1. **Bundle Creation**: When `bundles.create` mutation is called
2. **Bundle Update**: When `bundles.update` mutation is called with product changes
3. **Manual Regeneration**: Trainer can request new image via `bundles.regenerateImage`

#### Image Specifications

| Property | Value |
|----------|-------|
| Format | PNG |
| Resolution | 1200x1200 pixels (square) |
| Thumbnail | 400x400 pixels (auto-generated) |
| Storage | S3 bucket with CDN |
| Naming | `bundles/{bundleId}/cover-{timestamp}.png` |

### API Changes

#### New Mutation: `bundles.regenerateImage`

```typescript
bundles.regenerateImage: trainerProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Regenerate cover image for bundle
    // Returns { imageUrl, thumbnailUrl }
  })
```

#### Updated Mutations

**`bundles.create`** - Now returns `{ id, imageUrl }`
- Automatically generates cover image after bundle creation
- Stores imageUrl in bundleDrafts table

**`bundles.update`** - Regenerates image when products change
- Compares old vs new productsJson
- Only regenerates if products actually changed

### Database Schema

The `bundleDrafts` table already has `imageUrl` field. Add:

```sql
ALTER TABLE bundle_drafts ADD COLUMN thumbnailUrl TEXT;
ALTER TABLE bundle_drafts ADD COLUMN imageGeneratedAt TIMESTAMP;
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Image generation fails | Bundle still created, imageUrl remains null, error logged |
| Timeout (>30s) | Use placeholder image, queue for retry |
| Invalid products | Generate generic fitness image based on goal type |

### Success Metrics

- 100% of new bundles have auto-generated cover images
- Image generation completes within 15 seconds
- Trainer satisfaction with generated images (survey)

---

## Future Enhancements

### Phase 2: Image Customization
- Allow trainers to upload custom images
- Provide image editing tools (crop, filters)
- Multiple image variants for A/B testing

### Phase 3: Video Generation
- Auto-generate short video previews of bundles
- Animated product showcases
- Trainer introduction clips

### Phase 4: Advanced Analytics
- Trainer performance leaderboards
- Customer lifetime value tracking
- Bundle conversion optimization

---

## Appendix: Prompt Engineering Notes

### Effective Prompts for Fitness Product Photography

**Base prompt structure:**
```
[Style] + [Lighting] + [Background] + [Products] + [Composition] + [Mood]
```

**Example variations by goal type:**

**Strength/Power:**
```
Dramatic, powerful product arrangement with bold shadows and high contrast. 
Products should feel substantial and performance-oriented.
```

**Weight Loss:**
```
Clean, fresh composition with bright accents. Light, airy feel suggesting 
transformation and new beginnings.
```

**Longevity/Wellness:**
```
Calm, balanced arrangement with soft natural lighting. Earthy tones and 
organic feel suggesting holistic health.
```

### Image Quality Guidelines

- Avoid cluttered compositions
- Ensure product labels are readable when possible
- Maintain consistent lighting direction
- Use negative space effectively
- Products should "float" slightly above surface for premium feel


---

## Feature: Trainer Commission System

### Overview

Trainers earn commissions on product sales within their bundles. The commission system consists of two components: a **base commission rate** that applies to all products, and a **Special Product Fee (SPF)** that provides additional commission on specific products during promotional periods. This incentivizes trainers to promote certain products while ensuring they earn fair compensation for their sales efforts.

### User Stories

> As a trainer, I want to see exactly how much commission I'll earn on each bundle sale so that I can make informed decisions about which products to include.

> As a trainer, I want to know which products have special promotional fees so that I can maximize my earnings by featuring those products.

> As an admin, I want to set special product fees on specific products to incentivize trainers to promote certain items during promotional campaigns.

### Commission Components

| Component | Description | Example |
|-----------|-------------|---------|
| **Base Commission** | Platform-wide percentage applied to all product sales | 10% of product price |
| **SPF (Special Product Fee)** | Additional percentage for specific products during promotions | +20% for Red Bull products |
| **Service Revenue** | 100% of service fees go directly to the trainer | $50/session coaching |

### Commission Calculation Formula

The total trainer earnings per bundle sold is calculated as follows:

```
Product Commission = Σ (Product Price × (Base Commission % + SPF %))
Service Revenue = Σ (Service Price × Service Quantity)
Total Trainer Earnings = Product Commission + Service Revenue
```

**Example Calculation:**

| Item | Price | Base (10%) | SPF | Total Commission |
|------|-------|------------|-----|------------------|
| Red Bull 12-pack | $24.99 | $2.50 | +20% ($5.00) | $7.50 |
| Protein Powder | $49.99 | $5.00 | 0% | $5.00 |
| Resistance Bands | $19.99 | $2.00 | +5% ($1.00) | $3.00 |
| **Product Subtotal** | $94.97 | | | **$15.50** |
| Personal Training (2 sessions) | $100.00 | N/A | N/A | $100.00 |
| **Total Trainer Earnings** | | | | **$115.50** |

### Database Schema

#### Product SPF Table

```sql
CREATE TABLE product_spf (
  id SERIAL PRIMARY KEY,
  shopify_product_id BIGINT NOT NULL,
  spf_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  notes TEXT
);

CREATE INDEX idx_product_spf_product ON product_spf(shopify_product_id);
CREATE INDEX idx_product_spf_dates ON product_spf(start_date, end_date);
```

#### Platform Settings Table

```sql
CREATE TABLE platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- Insert default base commission
INSERT INTO platform_settings (key, value) VALUES ('base_commission_rate', '0.10');
```

### API Endpoints

#### Get Product SPF Rates

```typescript
products.getSPFRates: publicProcedure
  .query(async () => {
    // Returns all active SPF rates for products
    // Only returns SPF where current date is between start_date and end_date
    return {
      baseCommissionRate: 0.10,
      productSPF: [
        { shopifyProductId: 123, spfPercentage: 0.20, endDate: "2026-03-01" },
        { shopifyProductId: 456, spfPercentage: 0.05, endDate: "2026-02-15" }
      ]
    };
  })
```

#### Admin: Set Product SPF

```typescript
admin.setProductSPF: adminProcedure
  .input(z.object({
    shopifyProductId: z.number(),
    spfPercentage: z.number().min(0).max(1),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    notes: z.string().optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Create or update SPF for product
  })
```

#### Admin: Update Base Commission

```typescript
admin.setBaseCommission: adminProcedure
  .input(z.object({
    rate: z.number().min(0).max(1)
  }))
  .mutation(async ({ input, ctx }) => {
    // Update platform_settings base_commission_rate
  })
```

### Bundle Editor UI Changes

The bundle editor displays real-time commission calculations:

1. **Product List Enhancement**
   - Each product shows its SPF badge if applicable (e.g., "+20% SPF")
   - Products with active SPF are highlighted
   - SPF expiration date shown for time-limited promotions

2. **Commission Summary Panel**
   - Displays at bottom of bundle editor
   - Shows breakdown: Product Commission + Service Revenue = Total Earnings
   - Updates in real-time as products/services are added/removed

3. **Visual Indicators**
   - Green highlight for products with high SPF
   - Countdown for expiring SPF promotions
   - Commission amount shown next to each product

### Commission Display Example

```
┌─────────────────────────────────────────────────────────┐
│ Your Earnings Per Bundle Sale                           │
├─────────────────────────────────────────────────────────┤
│ Product Commissions                                     │
│   Red Bull 12-pack        $24.99 × 30%  =    $7.50     │
│   Protein Powder          $49.99 × 10%  =    $5.00     │
│   Resistance Bands        $19.99 × 15%  =    $3.00     │
│                                         ─────────────   │
│   Subtotal                              =   $15.50     │
├─────────────────────────────────────────────────────────┤
│ Service Revenue                                         │
│   Personal Training (×2)  $50.00 each   =  $100.00     │
│                                         ─────────────   │
│   Subtotal                              =  $100.00     │
├─────────────────────────────────────────────────────────┤
│ TOTAL EARNINGS PER SALE                 =  $115.50     │
└─────────────────────────────────────────────────────────┘
```

### Admin Dashboard Features

1. **SPF Management Panel**
   - View all products with active SPF
   - Set/update SPF percentages
   - Schedule promotional periods
   - View historical SPF campaigns

2. **Commission Analytics**
   - Total commissions paid to trainers
   - Commission breakdown by product
   - SPF campaign effectiveness metrics

### Success Metrics

| Metric | Target |
|--------|--------|
| Trainer commission visibility | 100% of trainers see commission before publishing |
| SPF product inclusion rate | 40% increase in SPF product selection |
| Trainer satisfaction with earnings transparency | >4.5/5 rating |

### Future Enhancements

1. **Tiered Commission Rates**: Higher base commission for top-performing trainers
2. **Volume Bonuses**: Additional commission for hitting sales milestones
3. **Referral Commissions**: Earnings from referred trainers' sales
4. **Commission Forecasting**: AI-powered earnings predictions based on historical data


---

## Feature: Trainer Earnings Dashboard

### Overview

The Trainer Earnings Dashboard provides trainers with a comprehensive view of their income from bundle sales, broken down by products and services. It includes time-based filtering and a delivery schedule to help trainers manage their client commitments.

### User Stories

> As a trainer, I want to see my total earnings at a glance so I can track my income.

> As a trainer, I want to filter earnings by time period so I can see weekly/monthly/yearly performance.

> As a trainer, I want to see a breakdown of product vs service income so I can understand my revenue mix.

> As a trainer, I want to see which products earn me the most commission so I can focus on promoting them.

> As a trainer, I want a delivery schedule so I know what services I need to provide to clients.

> As a trainer, I want to mark deliveries as complete so I can track my progress.

### Dashboard Components

#### 1. Earnings Summary Cards

| Metric | Description |
|--------|-------------|
| **Total Earnings** | Sum of all product commissions + service revenue for the period |
| **Product Commissions** | Total earned from product sales (Base% + SPF%) |
| **Service Revenue** | Total earned from services (100% to trainer) |
| **Bundles Sold** | Count of bundles sold in the period |

#### 2. Time Period Filtering

Trainers can filter their earnings by:

| Period | Description |
|--------|-------------|
| **This Week** | Current 7-day period (Monday to Sunday) |
| **This Month** | Current calendar month |
| **This Year** | Current calendar year |
| **All Time** | Complete history since account creation |
| **Custom Range** | User-defined start and end dates |

#### 3. Earnings Breakdown Charts

**Revenue Split Chart (Pie/Donut):**
- Products vs Services percentage split
- Visual representation of income sources

**Earnings Trend Chart (Line/Bar):**
- Daily/weekly/monthly earnings over time
- Comparison to previous period

**Top Earners Table:**
- Top 5 products by commission earned
- Top 5 services by revenue
- Commission rate and total earned for each

#### 4. Delivery Schedule

The delivery schedule shows trainers what services they need to fulfill for their clients:

| Column | Description |
|--------|-------------|
| **Client** | Name of the client who purchased |
| **Bundle** | Bundle title purchased |
| **Service** | Service type to be delivered |
| **Remaining** | Number of sessions remaining to deliver |
| **Delivered** | Number of sessions already completed |
| **Status** | Pending, In Progress, Completed |
| **Purchase Date** | When the bundle was purchased |

**Status Definitions:**
- **Pending**: No sessions delivered yet
- **In Progress**: Some sessions delivered, more remaining
- **Completed**: All sessions delivered

### Data Model

#### Earnings Calculation

```
For each bundle sale:
  Product Commission = Σ (Product Price × (Base Rate + SPF Rate))
  Service Revenue = Σ (Service Price × Quantity)
  Total Earnings = Product Commission + Service Revenue
```

#### Delivery Tracking Schema

```sql
CREATE TABLE service_deliveries (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  trainer_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES users(id),
  bundle_id INTEGER NOT NULL REFERENCES bundle_drafts(id),
  service_type VARCHAR(100) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  total_quantity INTEGER NOT NULL,
  delivered_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  price_per_unit DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_deliveries_trainer ON service_deliveries(trainer_id);
CREATE INDEX idx_deliveries_status ON service_deliveries(status);
```

### API Endpoints

#### Get Earnings Summary

```typescript
trainer.getEarningsSummary: trainerProcedure
  .input(z.object({
    period: z.enum(['week', 'month', 'year', 'all']),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Returns:
    // - totalEarnings: number
    // - productCommissions: number
    // - serviceRevenue: number
    // - bundlesSold: number
    // - periodComparison: { previous: number, change: number }
  })
```

#### Get Earnings Breakdown

```typescript
trainer.getEarningsBreakdown: trainerProcedure
  .input(z.object({
    period: z.enum(['week', 'month', 'year', 'all']),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Returns:
    // - byProduct: [{ name, quantity, commission, percentage }]
    // - byService: [{ name, quantity, revenue, percentage }]
    // - revenueByDay: [{ date, products, services, total }]
  })
```

#### Get Delivery Schedule

```typescript
trainer.getDeliverySchedule: trainerProcedure
  .input(z.object({
    status: z.enum(['all', 'pending', 'in_progress', 'completed']).optional(),
    clientId: z.number().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Returns array of deliveries with client info
  })
```

#### Update Delivery Status

```typescript
trainer.updateDelivery: trainerProcedure
  .input(z.object({
    deliveryId: z.number(),
    deliveredCount: z.number().optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Update delivery progress
    // Auto-complete when deliveredCount === totalQuantity
  })
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Earnings Dashboard                          [This Week ▼] [Export]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Total        │ │ Products     │ │ Services     │ │ Bundles      │ │
│ │ $1,250.00    │ │ $450.00      │ │ $800.00      │ │ 12           │ │
│ │ ▲ +15%       │ │ ▲ +8%        │ │ ▲ +22%       │ │ ▲ +3         │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ Revenue Split               │ │ Earnings Trend                  │ │
│ │ [Pie Chart]                 │ │ [Line Chart]                    │ │
│ │ Products: 36%               │ │                                 │ │
│ │ Services: 64%               │ │                                 │ │
│ └─────────────────────────────┘ └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ Delivery Schedule                                    [Filter ▼]     │
│ ┌───────────────────────────────────────────────────────────────────┤
│ │ Client      │ Bundle           │ Service        │ Progress │ Act │
│ │ John Smith  │ Strength Starter │ Training (1hr) │ 2/4      │ [+] │
│ │ Jane Doe    │ Weight Loss Pro  │ Check-in Call  │ 0/8      │ [+] │
│ │ Mike Johnson│ Longevity Pack   │ Plan Review    │ 3/3  ✓   │     │
│ └───────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### Success Metrics

| Metric | Target |
|--------|--------|
| Dashboard daily active usage | 80% of trainers check weekly |
| Delivery completion rate | 95% of services marked complete |
| Time to first delivery update | Within 48 hours of purchase |

### Future Enhancements

1. **Export to CSV/PDF**: Download earnings reports for tax purposes
2. **Goal Setting**: Set monthly earnings targets with progress tracking
3. **Client Communication**: Send delivery reminders directly from dashboard
4. **Calendar Integration**: Sync delivery schedule with Google/Apple Calendar
5. **Earnings Forecasting**: AI-powered predictions based on pipeline and history



---

## Feature: Client Financial Statements & Transaction History

### Overview

The Client Financial Statements feature provides clients with a comprehensive view of all their spending on the LocoMotivate platform. This includes purchases from multiple trainers, broken down by products, services, and facility fees. Clients can access detailed transaction history, download PDF receipts for insurance claims, employer wellness program reimbursements, and tax purposes as required in the UK.

### User Stories

> As a client, I want to see my total spending across all trainers so I can track my fitness investment.

> As a client, I want to see a breakdown of what I've spent on products vs services vs facility fees so I can understand where my money goes.

> As a client, I want to download PDF receipts for each transaction so I can submit them for insurance reimbursement.

> As a client, I want to see a running total of my spending by category so I can budget my fitness expenses.

> As a client, I want to click on any transaction to see the full breakdown of products and services included.

> As a client, I want to filter my transactions by date range and trainer so I can find specific purchases.

### Dashboard Components

#### 1. Spending Summary Cards

| Metric | Description |
|--------|-------------|
| **Total Spent** | Sum of all purchases across all trainers |
| **Products** | Total spent on physical products (supplements, equipment, etc.) |
| **Services** | Total spent on training services (sessions, programs, etc.) |
| **Facility Fees** | Total spent on facility access, memberships, etc. |

#### 2. Running Totals by Period

| Period | Display |
|--------|---------|
| **This Month** | Current month spending with comparison to previous month |
| **This Year** | Year-to-date spending with monthly breakdown |
| **All Time** | Lifetime spending on the platform |

#### 3. Transaction List

The main transaction table displays:

| Column | Description |
|--------|-------------|
| **Date** | Transaction date (sortable) |
| **Trainer Name** | Name of the trainer (with profile link) |
| **Bundle Name** | Name of the purchased bundle |
| **Gross Amount** | Total transaction amount |
| **Statement** | Download PDF button |

Each row is clickable to expand and show full transaction details.

#### 4. Transaction Detail View

When a transaction is clicked, it expands to show:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Transaction #12345                              January 15, 2026    │
│ Trainer: Sarah Johnson                                              │
│ Bundle: Complete Fitness Starter Pack                               │
├─────────────────────────────────────────────────────────────────────┤
│ PRODUCTS                                                            │
│   Whey Protein Isolate (2kg)              ×1        £49.99         │
│   Resistance Band Set                      ×1        £24.99         │
│   Shaker Bottle                            ×1        £12.99         │
│                                           ─────────────────         │
│   Products Subtotal                                  £87.97         │
├─────────────────────────────────────────────────────────────────────┤
│ SERVICES                                                            │
│   Personal Training Session (60 min)       ×4       £200.00         │
│   Nutrition Consultation                   ×1        £75.00         │
│                                           ─────────────────         │
│   Services Subtotal                                 £275.00         │
├─────────────────────────────────────────────────────────────────────┤
│ FACILITY FEES                                                       │
│   Gym Access Fee                           ×1        £25.00         │
│                                           ─────────────────         │
│   Facility Subtotal                                  £25.00         │
├─────────────────────────────────────────────────────────────────────┤
│ TRANSACTION TOTAL                                   £387.97         │
│                                                                     │
│ [Download PDF Receipt]  [Download Itemized Statement]               │
└─────────────────────────────────────────────────────────────────────┘
```

### PDF Receipt Format

The downloadable PDF receipt includes:

1. **Header**
   - LocoMotivate logo and company details
   - Receipt number and date
   - Client name and address

2. **Transaction Summary**
   - Trainer name and contact
   - Bundle name and description
   - Purchase date and payment method

3. **Itemized Breakdown**
   - Products section with individual items, quantities, and prices
   - Services section with descriptions and prices
   - Facility fees section
   - Subtotals for each category
   - VAT breakdown (if applicable)
   - Grand total

4. **Footer**
   - Statement: "This receipt may be used for insurance claims, employer wellness program reimbursements, or tax purposes"
   - Company registration details
   - Contact information for queries

### UK-Specific Compliance

The receipt format supports UK requirements for:

| Use Case | Supported Fields |
|----------|-----------------|
| **Insurance Claims** | Itemized services with dates, provider details, service descriptions |
| **Employer Wellness Programs** | Category breakdown, company VAT number, formal receipt format |
| **Tax Deductions** | VAT breakdown, business expense categorization |
| **Health Savings Accounts** | Medical/wellness service identification |

### Data Model

```sql
-- Client spending summary view
CREATE VIEW client_spending_summary AS
SELECT 
  client_id,
  SUM(CASE WHEN category = 'product' THEN amount ELSE 0 END) as product_total,
  SUM(CASE WHEN category = 'service' THEN amount ELSE 0 END) as service_total,
  SUM(CASE WHEN category = 'facility' THEN amount ELSE 0 END) as facility_total,
  SUM(amount) as grand_total,
  COUNT(DISTINCT order_id) as transaction_count
FROM order_line_items
JOIN orders ON orders.id = order_line_items.order_id
GROUP BY client_id;

-- Transaction detail for receipts
CREATE TABLE order_line_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  category VARCHAR(20) NOT NULL, -- 'product', 'service', 'facility'
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  trainer_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_line_items_order ON order_line_items(order_id);
CREATE INDEX idx_line_items_category ON order_line_items(category);
```

### API Endpoints

#### Get Client Spending Summary

```typescript
client.getSpendingSummary: clientProcedure
  .input(z.object({
    period: z.enum(['month', 'year', 'all']),
    trainerId: z.number().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Returns:
    // - totalSpent: number
    // - productTotal: number
    // - serviceTotal: number
    // - facilityTotal: number
    // - transactionCount: number
    // - periodComparison: { previous: number, change: number }
  })
```

#### Get Transaction History

```typescript
client.getTransactions: clientProcedure
  .input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    trainerId: z.number().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))
  .query(async ({ input, ctx }) => {
    // Returns paginated list of transactions with trainer info
  })
```

#### Get Transaction Detail

```typescript
client.getTransactionDetail: clientProcedure
  .input(z.object({ orderId: z.number() }))
  .query(async ({ input, ctx }) => {
    // Returns full transaction breakdown with line items
  })
```

#### Generate PDF Receipt

```typescript
client.generateReceipt: clientProcedure
  .input(z.object({ 
    orderId: z.number(),
    format: z.enum(['receipt', 'itemized_statement'])
  }))
  .mutation(async ({ input, ctx }) => {
    // Generates and returns PDF download URL
  })
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ My Spending                              [This Year ▼] [Export All] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Total Spent  │ │ Products     │ │ Services     │ │ Facility     │ │
│ │ £2,450.00    │ │ £650.00      │ │ £1,550.00    │ │ £250.00      │ │
│ │ 12 orders    │ │ 26.5%        │ │ 63.3%        │ │ 10.2%        │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ Filter: [All Trainers ▼] [Date Range: _____ to _____] [Search]      │
├─────────────────────────────────────────────────────────────────────┤
│ TRANSACTIONS                                                        │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Jan 15  Sarah Johnson   Complete Fitness Pack    £387.97  📄  │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ Jan 10  Mike Thompson   Recovery Bundle          £245.00  📄  │   │
│ ├───────────────────────────────────────────────────────────────┤   │
│ │ Jan 3   Sarah Johnson   Monthly Training         £200.00  📄  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Showing 1-10 of 45 transactions                    [< 1 2 3 4 5 >]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Success Metrics

| Metric | Target |
|--------|--------|
| Receipt download rate | >30% of transactions have PDF downloaded |
| Client spending visibility | 100% of clients can view full history |
| Support tickets for receipts | <5 per month |
| Insurance claim success rate | >95% of submitted receipts accepted |

### Future Enhancements

1. **Automated Monthly Statements**: Email monthly spending summaries to clients
2. **Budget Tracking**: Allow clients to set monthly fitness budgets with alerts
3. **Spending Analytics**: Charts showing spending trends over time
4. **Multi-Currency Support**: Display amounts in client's preferred currency
5. **Direct Insurance Submission**: Integration with UK health insurers for direct claim submission
6. **Employer Portal**: Allow employers to verify wellness spending for reimbursement programs

