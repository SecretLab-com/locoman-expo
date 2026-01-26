# Product Delivery Customer Journey

> **Note:** Based on initial React implementation at: https://github.com/SecretLab-com/locoman
> 
> This mobile app version is built with **Expo SDK 54**, **React Native**, and **TypeScript**.

## Overview

This document describes the complete workflow for trainer-to-client product delivery within LocoMotivate. When a trainer includes physical products (e.g., Theragun, supplements, equipment) in their bundles, these products must be physically handed to the client. This journey ensures smooth coordination between trainers and clients for product handoffs.

---

## Journey Actors

| Actor | Role | Key Actions |
|-------|------|-------------|
| **Trainer** | Product deliverer | Adds products to bundles, receives delivery alerts, hands products to clients, marks as delivered |
| **Client** | Product recipient | Approves bundle invitation, pays for bundle, receives products, confirms receipt or reports issues |
| **Manager** | Platform administrator | Approves bundles, monitors delivery metrics, resolves disputes |
| **System** | Automation | Sends reminders, tracks status, creates delivery records |

---

## Journey Steps

### Step 1: Trainer Adds Product to Bundle

**Actor:** Trainer

**Description:** The trainer creates or edits a bundle and adds physical products that will be delivered directly to the client (marked as "trainer_delivery" fulfillment method).

**System Support:**
- ✅ Bundle editor allows adding products from Shopify catalog
- ✅ Products can be marked with fulfillment options including "trainer_delivery"
- ✅ Bundle shows product list with quantities and prices

**UI Location:** `/trainer/bundles/new` or `/trainer/bundles/:id/edit`

---

### Step 2: Bundle Approval and Publishing

**Actor:** Manager → Trainer

**Description:** The trainer submits the bundle for approval. A manager reviews and approves the bundle, allowing it to be published to Shopify.

**System Support:**
- ✅ Bundle approval workflow with status tracking (draft → pending_approval → approved → published)
- ✅ Manager approval queue at `/manager/approvals`
- ✅ Trainer receives notification when bundle is approved/rejected
- ✅ Bundle can be published to Shopify after approval

**UI Location:** `/manager/approvals`, `/trainer/bundles`

---

### Step 3: Trainer Suggests Bundle to Customer (Invitation)

**Actor:** Trainer

**Description:** The trainer sends a bundle invitation to a potential or existing client via email. The invitation includes a personalized message and link to view the bundle.

**System Support:**
- ✅ Bundle invitation system with email delivery
- ✅ Invitation tracking (pending, viewed, accepted, declined, expired)
- ✅ Personalized invitation messages
- ✅ Invitation management at `/trainer/invitations`

**UI Location:** `/trainer/bundles/:id` (Send Invitation button), `/trainer/invitations`

---

### Step 4: Customer Approves and Pays

**Actor:** Client

**Description:** The client receives the invitation email, clicks the link to view the bundle details, and proceeds to purchase through Shopify checkout.

**System Support:**
- ✅ Invitation landing page shows bundle details, trainer info, and products
- ✅ "Accept & Purchase" redirects to Shopify checkout
- ✅ Shopify webhook captures order creation and payment
- ✅ Order record created with client and trainer association

**UI Location:** `/invite/:token`, Shopify checkout

---

### Step 5: Product Delivery Scheduled for First Session

**Actor:** System → Trainer

**Description:** When an order is paid, the system should automatically create product delivery records and schedule them for the client's first session or a default delivery date.

**System Support:**
- ⚠️ **PARTIALLY IMPLEMENTED** - `createProductDeliveries()` function exists but is not called from order webhooks
- ✅ Product delivery schema supports `scheduledDate` field
- ✅ Trainer can manually schedule deliveries at `/trainer/deliveries`
- ❌ **MISSING:** Automatic creation of product delivery records when order is paid
- ❌ **MISSING:** Automatic scheduling based on first session or default date

**UI Location:** `/trainer/deliveries`

---

### Step 6: Trainer Gets 1-Day Reminder Alert

**Actor:** System → Trainer

**Description:** One day before a scheduled delivery, the trainer receives an alert/notification reminding them to bring the product for the client.

**System Support:**
- ❌ **MISSING:** Delivery reminder notification system
- ❌ **MISSING:** Cron job or scheduled task to check upcoming deliveries
- ❌ **MISSING:** Push notification or email for delivery reminders
- ✅ Trainer dashboard exists at `/trainer/dashboard` where alerts could be shown

**UI Location:** `/trainer/dashboard`, `/trainer/deliveries`

---

### Step 7: Trainer Hands Product to Customer

**Actor:** Trainer → Client

**Description:** The trainer physically hands the product to the client during a session or at an agreed location.

**System Support:**
- ✅ Delivery methods supported: in_person, locker, front_desk, shipped
- ✅ Trainer can add notes about the delivery
- ✅ Tracking number field for shipped items

**UI Location:** `/trainer/deliveries`

---

### Step 8: Trainer Marks Product as Delivered

**Actor:** Trainer

**Description:** After handing the product to the client, the trainer marks the delivery as complete in the system.

**System Support:**
- ✅ `markDelivered` mutation in productDeliveries router
- ✅ Trainer can select delivery method and add notes
- ✅ Delivery status changes from "pending/ready" to "delivered"
- ✅ Activity logged for audit trail

**UI Location:** `/trainer/deliveries` (Pending tab → Mark Delivered button)

---

### Step 9: Customer Sees Confirmation

**Actor:** Client

**Description:** The client sees the delivery in their "To Confirm" list and can review the delivery details.

**System Support:**
- ✅ Client deliveries page at `/client/deliveries`
- ✅ "To Confirm" tab shows deliveries marked as delivered
- ✅ Client can see product name, trainer, delivery method, and notes

**UI Location:** `/client/deliveries` (To Confirm tab)

---

### Step 10: Customer Confirms or Contests Delivery

**Actor:** Client

**Description:** The client either confirms they received the product or reports an issue if there's a problem.

**System Support:**
- ✅ `confirmReceipt` mutation for client confirmation
- ✅ `reportIssue` mutation for dispute reporting
- ✅ Client can add notes when confirming or reporting issues
- ✅ Status changes to "confirmed" or "disputed"
- ✅ Activity logged for both actions

**UI Location:** `/client/deliveries` (To Confirm tab → Confirm Receipt or Report Issue buttons)

---

## Gap Analysis

### Missing Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Auto-create delivery records** | HIGH | When order is paid, automatically create product delivery records for trainer_delivery items |
| **Delivery reminder notifications** | HIGH | Send trainer alerts 1 day before scheduled deliveries |
| **Auto-schedule deliveries** | MEDIUM | Schedule deliveries based on first session or default date |
| **Delivery reminder cron job** | MEDIUM | Background job to check and send delivery reminders |
| **Manager dispute resolution** | LOW | Manager interface to resolve disputed deliveries |

### Implementation Plan

1. **Phase 1: Auto-create delivery records**
   - Modify `handleOrderPaid` webhook to call `createProductDeliveries`
   - Extract trainer_delivery products from order items
   - Set initial scheduled date (order date + 7 days or first session)

2. **Phase 2: Delivery reminder system**
   - Create `getUpcomingDeliveries` function to find deliveries due in 24 hours
   - Add delivery reminder notification type
   - Create cron job to run daily and send reminders
   - Show upcoming delivery alerts on trainer dashboard

3. **Phase 3: Enhanced scheduling**
   - Integrate with calendar/session system
   - Auto-suggest delivery date based on next session
   - Allow clients to request delivery date changes

---

## Data Model

### Product Deliveries Table

```sql
CREATE TABLE product_deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,           -- References orders.id
  orderItemId INT NOT NULL,       -- References order_items.id
  trainerId INT NOT NULL,         -- Trainer responsible for delivery
  clientId INT NOT NULL,          -- Client receiving the product
  productName VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  status ENUM('pending', 'ready', 'delivered', 'confirmed', 'disputed') DEFAULT 'pending',
  scheduledDate TIMESTAMP,        -- When delivery is planned
  deliveredAt TIMESTAMP,          -- When trainer marked delivered
  confirmedAt TIMESTAMP,          -- When client confirmed receipt
  trainerNotes TEXT,              -- Notes from trainer about delivery
  clientNotes TEXT,               -- Notes from client (feedback/issues)
  deliveryMethod ENUM('in_person', 'locker', 'front_desk', 'shipped') DEFAULT 'in_person',
  trackingNumber VARCHAR(100),    -- For shipped items
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

---

## API Endpoints

### Trainer Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `productDeliveries.trainerPending` | Query | Get pending deliveries for trainer |
| `productDeliveries.trainerList` | Query | Get all deliveries with filters |
| `productDeliveries.trainerStats` | Query | Get delivery statistics |
| `productDeliveries.markReady` | Mutation | Mark delivery as ready for pickup |
| `productDeliveries.markDelivered` | Mutation | Mark delivery as delivered |
| `productDeliveries.schedule` | Mutation | Schedule a delivery date |

### Client Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `productDeliveries.clientList` | Query | Get client's deliveries |
| `productDeliveries.confirmReceipt` | Mutation | Confirm product received |
| `productDeliveries.reportIssue` | Mutation | Report delivery issue |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Delivery confirmation rate | >95% | TBD |
| Average time to confirmation | <48 hours | TBD |
| Dispute rate | <2% | TBD |
| Reminder effectiveness | >80% on-time deliveries | TBD |

---

## Related Documentation

- [PRD.md](./PRD.md) - Product Requirements Document
- [TRAINER_LOYALTY.md](./TRAINER_LOYALTY.md) - Trainer loyalty program
- [SHOPIFY_INTEGRATION.md](./SHOPIFY_INTEGRATION.md) - Shopify integration details
