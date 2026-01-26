# LocoMotivate Comprehensive Usage Guide

**Version:** 1.0  
**Last Updated:** January 2025  
**Author:** Manus AI

---

## Executive Summary

LocoMotivate is a fitness platform that connects personal trainers with their clients through customizable wellness bundles. The platform integrates with Shopify for product management and order fulfillment, enabling trainers to create curated bundles of supplements, equipment, and services that clients can purchase through a seamless e-commerce experience.

This document provides a comprehensive overview of all user roles, their capabilities, and how each feature is implemented within the application.

---

## Table of Contents

1. [User Roles Overview](#user-roles-overview)
2. [Shopper (Public User)](#shopper-public-user)
3. [Client](#client)
4. [Trainer](#trainer)
5. [Manager](#manager)
6. [Coordinator](#coordinator)
7. [System Integration Points](#system-integration-points)
8. [Data Flow Diagrams](#data-flow-diagrams)

---

## User Roles Overview

The platform defines five distinct user roles, each with progressively increasing permissions. The role hierarchy ensures that higher-level roles inherit the capabilities of lower-level roles where appropriate.

| Role | Description | Access Level |
|------|-------------|--------------|
| **Shopper** | Anonymous or authenticated users browsing the catalog | Public |
| **Client** | Customers assigned to a specific trainer | Protected |
| **Trainer** | Fitness professionals managing clients and bundles | Protected + CRM |
| **Manager** | Platform administrators overseeing trainers and content | Admin |
| **Coordinator** | Super administrators with full system access | Full Admin |

The role assignment is stored in the `users` table with the `role` field, which defaults to "shopper" for new users. Role upgrades are managed by managers or coordinators through the admin interface.

---

## Shopper (Public User)

Shoppers represent the entry point for all users on the platform. They can browse the catalog, view trainer profiles, and add bundles to their cart without authentication. Authentication is required only at checkout.

### Tasks and Capabilities

| Task | Description | Implementation |
|------|-------------|----------------|
| Browse Catalog | View all published bundles | `/catalog` → `Catalog.tsx` |
| View Bundle Details | See bundle contents, pricing, and fulfillment options | `/bundle/:id` → `BundleDetail.tsx` |
| Browse Products | View individual Shopify products | `/products` → `ShopperProducts.tsx` |
| Add to Cart | Add bundles to shopping cart | `CartContext.tsx` (local storage) |
| View Cart | Review cart contents and modify quantities | `/cart` → `Cart.tsx` |
| Checkout | Complete purchase (requires auth) | Redirects to Shopify checkout |
| Browse Trainers | View trainer directory | `/trainers` → `TrainerDirectory.tsx` |
| View Trainer Profile | See trainer's public landing page | `/t/:username` → `TrainerLanding.tsx` |
| Request to Join Trainer | Send join request to a trainer | `joinRequests.create` mutation |

### API Endpoints (Public)

The following tRPC routes are accessible without authentication:

```
catalog.list          → List published bundles
catalog.bundleDetail  → Get bundle details
products.list         → List products
products.get          → Get product details
templates.list        → List bundle templates
templates.listActive  → List active templates
trainers.directory    → List active trainers
trainerProfile.byUsername → Get trainer by username
shopify.products      → Fetch Shopify products
```

### User Flow

1. User lands on home page (`/`)
2. Browses catalog or trainer directory
3. Views bundle details and selects fulfillment method
4. Adds bundle to cart
5. Proceeds to checkout (authentication required)
6. Redirected to Shopify checkout for payment

---

## Client

Clients are customers who have been assigned to a specific trainer, either through an invitation or by requesting to join. They have access to their subscriptions, orders, and can communicate with their trainer.

### Tasks and Capabilities

| Task | Description | Implementation |
|------|-------------|----------------|
| View Dashboard | Personal home with trainer info | `/client` → `ClientHome.tsx` |
| Manage Subscriptions | View, pause, or cancel subscriptions | `/client/subscriptions` → `ClientSubscriptions.tsx` |
| View Orders | Track order history and status | `/client/orders` → `ClientOrders.tsx` |
| Accept Invitation | Join a trainer via invitation link | `/invite/:token` → `InviteAccept.tsx` |
| Message Trainer | Send and receive messages | `messages.*` routes |

### API Endpoints (Client)

```
subscriptions.listByClient  → Get client's subscriptions
orders.listByClient         → Get client's orders
messages.conversations      → Get message threads
messages.list               → Get messages in thread
messages.send               → Send message
messages.markRead           → Mark messages as read
joinRequests.myRequests     → View pending join requests
invitations.accept          → Accept trainer invitation
```

### Subscription Management

Clients can manage their subscriptions through the subscriptions page. Each subscription has the following states:

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **Active** | Currently active subscription | Pause, Cancel |
| **Paused** | Temporarily suspended | Resume, Cancel |
| **Cancelled** | Permanently ended | None |

The subscription update flow uses the `subscriptions.update` mutation with status changes triggering appropriate timestamp updates (`pausedAt`, `cancelledAt`).

---

## Trainer

Trainers are fitness professionals who create bundles, manage clients, and fulfill orders. They have access to a comprehensive CRM system and can customize their public profile for marketing purposes.

### Tasks and Capabilities

| Task | Description | Implementation |
|------|-------------|----------------|
| View Dashboard | Overview of stats, clients, orders | `/trainer` → `TrainerDashboard.tsx` |
| Manage Bundles | Create, edit, submit for review | `/trainer/bundles` → `TrainerBundles.tsx` |
| Create Bundle | Build new bundle from template | `/trainer/bundles/new` → `BundleEditor.tsx` |
| Edit Bundle | Modify existing bundle | `/trainer/bundles/:id` → `BundleEditor.tsx` |
| Submit for Review | Send bundle for manager approval | `bundles.submitForReview` mutation |
| Manage Clients | View and manage client list | `/trainer/clients` → `TrainerClients.tsx` |
| View Client Detail | See individual client info | `/trainer/clients/:id` → `ClientDetail.tsx` |
| Invite Clients | Send email invitations | `invitations.send` mutation |
| Approve Join Requests | Accept customer requests | `joinRequests.approve` mutation |
| Manage Calendar | Schedule sessions and events | `/trainer/calendar` → `TrainerCalendar.tsx` |
| View Messages | Communicate with clients | `/trainer/messages` → `TrainerMessages.tsx` |
| View Orders | Track and fulfill orders | `/trainer/orders` → `TrainerOrders.tsx` |
| Update Profile | Edit public landing page | `trainerProfile.update` mutation |

### Bundle Workflow

The bundle creation and approval workflow follows these states:

```
draft → pending_review → [approved] → publishing → published
                      ↓
                   rejected → draft (revision)
```

| Status | Description | Next Actions |
|--------|-------------|--------------|
| **draft** | Work in progress | Edit, Submit for Review |
| **pending_review** | Awaiting manager approval | (Wait for manager) |
| **publishing** | Being published to Shopify | (Automatic) |
| **published** | Live on Shopify store | View in catalog |
| **rejected** | Returned with feedback | Edit, Resubmit |
| **failed** | Shopify publish failed | Retry |

### API Endpoints (Trainer)

```
bundles.list              → List trainer's bundles
bundles.get               → Get bundle details
bundles.create            → Create new bundle
bundles.update            → Update bundle
bundles.delete            → Delete bundle
bundles.submitForReview   → Submit for approval

clients.list              → List trainer's clients
clients.get               → Get client details
clients.create            → Add new client
clients.update            → Update client
clients.delete            → Remove client

invitations.list          → List sent invitations
invitations.send          → Send invitation
invitations.revoke        → Cancel invitation

joinRequests.listForTrainer → View join requests
joinRequests.approve        → Approve request
joinRequests.reject         → Reject request

sessions.listByClient     → Get client sessions
sessions.upcoming         → Get upcoming sessions
sessions.create           → Schedule session
sessions.update           → Update session

orders.listByTrainer      → Get trainer's orders
orders.recent             → Get recent orders
orders.byId               → Get order details
orders.updateStatus       → Update order status

subscriptions.listByTrainer → Get trainer's subscriptions
subscriptions.listActive    → Get active subscriptions
subscriptions.create        → Create subscription
subscriptions.update        → Update subscription

calendar.events           → Get calendar events
calendar.create           → Create event
calendar.update           → Update event

stats.trainer             → Get trainer statistics

trainerProfile.update     → Update profile
trainerProfile.checkUsername → Check username availability

shopify.publishBundle     → Publish bundle to Shopify
```

### Client Management

Trainers can acquire clients through two mechanisms:

**Trainer-Initiated (Invitations)**
1. Trainer sends invitation via email
2. System generates unique token with 7-day expiry
3. Customer receives email with invitation link
4. Customer logs in and accepts invitation
5. Customer becomes a client of the trainer

**Customer-Initiated (Join Requests)**
1. Customer browses trainer directory
2. Customer sends join request with optional message
3. Trainer reviews request in Clients tab
4. Trainer approves or rejects request
5. If approved, customer becomes a client

---

## Manager

Managers are platform administrators responsible for overseeing trainers, approving bundles, managing templates, and maintaining the product catalog. They have visibility across all trainers and can make platform-wide decisions.

### Tasks and Capabilities

| Task | Description | Implementation |
|------|-------------|----------------|
| View Dashboard | Platform overview and stats | `/manager` → `ManagerDashboard.tsx` |
| Manage Templates | Create and edit bundle templates | `/manager/templates` → `ManagerTemplates.tsx` |
| Create Template | Build new bundle template | `/manager/templates/new` → `TemplateEditor.tsx` |
| Edit Template | Modify existing template | `/manager/templates/:id` → `TemplateEditor.tsx` |
| Manage Trainers | View and manage all trainers | `/manager/trainers` → `ManagerTrainers.tsx` |
| View Trainer Detail | See trainer performance | `/manager/trainers/:id` → `TrainerDetail.tsx` |
| Approve Trainers | Approve pending trainer applications | `trainers.approve` mutation |
| Manage Products | Sync and view Shopify products | `/manager/products` → `ManagerProducts.tsx` |
| Approve Bundles | Review and approve bundle submissions | `/manager/approvals` → `BundleApprovals.tsx` |
| Update User Roles | Change user permissions | `auth.updateRole` mutation |
| Platform Settings | Configure platform options | `/manager/settings` → `ManagerSettings.tsx` |

### Bundle Approval Workflow

When a trainer submits a bundle for review, managers can:

| Action | Result | Implementation |
|--------|--------|----------------|
| **Approve** | Bundle published to Shopify | `admin.approveBundle` mutation |
| **Reject** | Bundle returned to draft with feedback | `admin.rejectBundle` mutation |
| **Request Changes** | Bundle returned for revision | `bundleApproval.requestChanges` mutation |

The approval process now includes automatic Shopify publishing:

1. Manager clicks "Approve" on pending bundle
2. System updates status to "publishing"
3. System calls Shopify API to create product
4. System creates `bundle_publications` record
5. System updates status to "published"
6. Bundle appears in Shopify admin and catalog

### API Endpoints (Manager)

```
templates.create          → Create template
templates.update          → Update template
templates.delete          → Delete template

trainers.list             → List all trainers
trainers.pending          → List pending trainers
trainers.approve          → Approve trainer
trainers.reject           → Reject trainer
trainers.suspend          → Suspend trainer

products.sync             → Sync from Shopify

bundleApproval.allBundles → View all bundles
bundleApproval.pending    → View pending bundles
bundleApproval.approve    → Approve bundle
bundleApproval.reject     → Reject bundle
bundleApproval.requestChanges → Request changes
bundleApproval.history    → View review history

admin.allClients          → View all clients
admin.allInvitations      → View all invitations
admin.allUsers            → View all users
admin.trainersWithStats   → View trainer statistics
admin.allBundles          → View all bundles
admin.pendingBundles      → View pending bundles
admin.approveBundle       → Approve and publish bundle
admin.rejectBundle        → Reject bundle

stats.manager             → Get platform statistics
activity.recent           → View recent activity

auth.updateRole           → Change user role

shopify.sync              → Sync products
```

### Template Management

Templates serve as starting points for trainers creating bundles. Each template includes:

| Field | Description |
|-------|-------------|
| `title` | Template name |
| `description` | Template description |
| `goalType` | Target goal (weight_loss, strength, longevity, power) |
| `basePrice` | Suggested price |
| `minPrice` / `maxPrice` | Price range constraints |
| `rulesJson` | Swap groups and constraints |
| `defaultServices` | Pre-configured services |
| `defaultProducts` | Pre-selected products |

---

## Coordinator

Coordinators have the highest level of access and inherit all manager capabilities. They can perform system-level operations and have unrestricted access to all platform features.

### Additional Capabilities

Coordinators share all manager capabilities but may have access to:

- System configuration
- Database administration
- Emergency overrides
- Audit log access

The coordinator role is primarily for platform owners and technical administrators.

---

## System Integration Points

### Shopify Integration

The platform integrates with Shopify for product management and order fulfillment:

| Integration Point | Description | Implementation |
|-------------------|-------------|----------------|
| Product Sync | Fetch products from Shopify | `shopify.fetchProducts()` |
| Bundle Publishing | Create Shopify products for bundles | `shopify.publishBundle()` |
| Checkout | Redirect to Shopify checkout | `shopify.getCheckoutUrl()` |
| Webhooks | Receive order updates | `shopifyWebhooks.ts` |

### Authentication

The platform uses Manus OAuth for authentication:

1. User clicks "Sign In"
2. Redirected to Manus OAuth portal
3. User authenticates
4. Callback receives session token
5. Session cookie set for subsequent requests

### File Storage

Files (images, documents) are stored in S3:

```typescript
import { storagePut } from "./server/storage";

const { url } = await storagePut(fileKey, fileBuffer, "image/png");
```

### AI Integration

The platform uses AI for bundle cover image generation:

```typescript
import { generateBundleCoverImage } from "./bundleImageGenerator";

const result = await generateBundleCoverImage({
  bundleId,
  title,
  products,
  goalType,
});
```

---

## Data Flow Diagrams

### Bundle Creation Flow

```
Trainer                    Platform                    Shopify
   │                          │                           │
   │──Create Bundle──────────>│                           │
   │                          │──Save Draft──────────────>│
   │                          │                           │
   │──Submit for Review──────>│                           │
   │                          │──Notify Manager──────────>│
   │                          │                           │
   │                     Manager Reviews                  │
   │                          │                           │
   │<─────────Approved────────│                           │
   │                          │──Create Product──────────>│
   │                          │<─────Product ID───────────│
   │                          │──Update Publication──────>│
   │                          │                           │
```

### Customer Purchase Flow

```
Customer                   Platform                    Shopify
   │                          │                           │
   │──Browse Catalog─────────>│                           │
   │<─────Bundle List─────────│                           │
   │                          │                           │
   │──Add to Cart────────────>│                           │
   │                          │──Store in LocalStorage───>│
   │                          │                           │
   │──Checkout───────────────>│                           │
   │                          │──Build Cart URL──────────>│
   │<────Redirect to Shopify──│                           │
   │                          │                           │
   │──Complete Payment───────────────────────────────────>│
   │                          │<────Webhook: Order────────│
   │                          │──Update Order Status─────>│
   │                          │                           │
```

### Client Onboarding Flow

```
Trainer                    Platform                    Customer
   │                          │                           │
   │──Send Invitation────────>│                           │
   │                          │──Generate Token──────────>│
   │                          │──Send Email──────────────>│
   │                          │                           │
   │                          │<────Click Link────────────│
   │                          │                           │
   │                          │──Verify Token────────────>│
   │                          │──Create Client Record────>│
   │<────Notification─────────│                           │
   │                          │                           │
```

---

## Database Schema Reference

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | All platform users | id, openId, role, trainerId |
| `bundle_templates` | Manager-created templates | id, title, goalType, rulesJson |
| `bundle_drafts` | Trainer bundles | id, trainerId, status, productsJson |
| `bundle_publications` | Shopify publish records | id, draftId, shopifyProductId |
| `clients` | Trainer-client relationships | id, trainerId, userId, status |
| `subscriptions` | Client subscriptions | id, clientId, trainerId, status |
| `orders` | Purchase orders | id, trainerId, clientId, status |
| `invitations` | Trainer invitations | id, trainerId, email, token |
| `join_requests` | Customer join requests | id, trainerId, userId, status |

### Status Enums

**Bundle Status:** draft, validating, ready, pending_review, publishing, published, failed, rejected

**Client Status:** pending, active, inactive

**Subscription Status:** active, paused, cancelled

**Order Status:** pending, processing, shipped, delivered, cancelled

**Invitation Status:** pending, accepted, expired, revoked

**Join Request Status:** pending, approved, rejected

---

## Appendix: Route Reference

### Public Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Landing page |
| `/catalog` | Catalog | Bundle catalog |
| `/bundle/:id` | BundleDetail | Bundle details |
| `/products` | ShopperProducts | Product listing |
| `/cart` | Cart | Shopping cart |
| `/trainers` | TrainerDirectory | Trainer directory |
| `/t/:username` | TrainerLanding | Trainer profile |
| `/invite/:token` | InviteAccept | Invitation acceptance |
| `/profile` | Profile | User profile |

### Client Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/client` | ClientHome | Client dashboard |
| `/client/subscriptions` | ClientSubscriptions | Subscription management |
| `/client/orders` | ClientOrders | Order history |

### Trainer Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/trainer` | TrainerDashboard | Trainer dashboard |
| `/trainer/bundles` | TrainerBundles | Bundle list |
| `/trainer/bundles/new` | BundleEditor | Create bundle |
| `/trainer/bundles/:id` | BundleEditor | Edit bundle |
| `/trainer/clients` | TrainerClients | Client list |
| `/trainer/clients/:id` | ClientDetail | Client details |
| `/trainer/calendar` | TrainerCalendar | Calendar |
| `/trainer/messages` | TrainerMessages | Messages |
| `/trainer/orders` | TrainerOrders | Orders |

### Manager Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/manager` | ManagerDashboard | Manager dashboard |
| `/manager/templates` | ManagerTemplates | Template list |
| `/manager/templates/new` | TemplateEditor | Create template |
| `/manager/templates/:id` | TemplateEditor | Edit template |
| `/manager/trainers` | ManagerTrainers | Trainer list |
| `/manager/trainers/:id` | TrainerDetail | Trainer details |
| `/manager/products` | ManagerProducts | Product management |
| `/manager/settings` | ManagerSettings | Platform settings |
| `/manager/approvals` | BundleApprovals | Bundle approval queue |

---

*This document is auto-generated and should be updated when significant features are added or modified.*
