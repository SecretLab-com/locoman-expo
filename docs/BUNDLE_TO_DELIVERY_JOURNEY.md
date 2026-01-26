# Bundle-to-Delivery Customer Journey

**Version:** 1.0  
**Author:** Manus AI  
**Last Updated:** January 2026

---

## Overview

This document describes the complete end-to-end journey from bundle creation by a trainer through product delivery to a customer. It covers all actors, screens, and interactions required to support the full LocoMotivate business workflow.

---

## Actors

| Actor | Role | Description |
|-------|------|-------------|
| **Trainer** | Service Provider | Creates bundles, delivers products, conducts sessions |
| **Manager/Superuser** | Administrator | Reviews and approves bundles, manages platform |
| **Customer/Client** | Consumer | Purchases bundles, receives products and sessions |
| **Coordinator** | Super Admin | Can impersonate any user for testing |

---

## Journey Steps

### Phase 1: Bundle Creation

#### Step 1.1: Trainer Creates Bundle from Template

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Bundles → New Bundle  
**Precondition:** Trainer is logged in with trainer role

The trainer navigates to their dashboard and selects "New Bundle" to create a new fitness bundle. They can optionally start from a template that pre-populates common configurations.

**Actions:**
1. Trainer clicks "New Bundle" button on dashboard
2. System displays bundle editor with tabs: Details, Services, Products, Goals
3. Trainer enters bundle title and description
4. Trainer selects billing cadence (One-Time, Weekly, Monthly)
5. Trainer can generate or upload a cover image

**Expected Outcome:** Bundle is created in "draft" status

---

#### Step 1.2: Trainer Adds Product to Bundle

**Actor:** Trainer  
**Screen:** Bundle Editor → Products Tab  
**Precondition:** Bundle exists in draft status

The trainer adds physical products to the bundle that will be delivered to the customer.

**Actions:**
1. Trainer navigates to Products tab in bundle editor
2. Trainer clicks "Add Product" button
3. System displays product selection modal with search/filter
4. Trainer selects products from Shopify catalog
5. Trainer sets quantity for each product
6. System auto-calculates bundle price including products

**Expected Outcome:** Products are added to bundle, price is updated

---

#### Step 1.3: Trainer Saves Bundle as Draft

**Actor:** Trainer  
**Screen:** Bundle Editor  
**Precondition:** Bundle has basic information

The trainer saves their work without submitting for review.

**Actions:**
1. Trainer clicks "Save Draft" button
2. System saves bundle with status "draft"
3. System displays success message
4. Bundle appears in trainer's "My Bundles" list with draft badge

**Expected Outcome:** Bundle is saved, trainer can continue editing later

---

### Phase 2: Bundle Review Workflow

#### Step 2.1: Trainer Submits Bundle for Review

**Actor:** Trainer  
**Screen:** Bundle Editor  
**Precondition:** Bundle is complete with all required fields

The trainer submits the bundle for manager approval before it can be published.

**Actions:**
1. Trainer reviews all bundle details
2. Trainer clicks "Submit for Review" button
3. System validates bundle has required fields
4. System changes bundle status to "pending_review"
5. System notifies managers of new bundle awaiting review

**Expected Outcome:** Bundle status changes to "pending_review", managers are notified

---

#### Step 2.2: Superuser Reviews Bundle and Adds Comments

**Actor:** Manager/Superuser  
**Screen:** Manager Dashboard → Approvals  
**Precondition:** Bundle is in "pending_review" status

The manager reviews the submitted bundle and provides feedback.

**Actions:**
1. Manager navigates to Approvals screen
2. Manager sees list of bundles pending review
3. Manager clicks on bundle to view details
4. Manager reviews title, description, products, services, pricing
5. Manager adds review comment (e.g., "Please add more product variety")
6. Manager clicks "Request Changes" button
7. System changes bundle status to "changes_requested"
8. System notifies trainer of feedback

**Expected Outcome:** Bundle status changes to "changes_requested", trainer receives feedback

---

#### Step 2.3: Trainer Reviews Comments and Makes Changes

**Actor:** Trainer  
**Screen:** Bundle Editor  
**Precondition:** Bundle has "changes_requested" status with comments

The trainer addresses the manager's feedback.

**Actions:**
1. Trainer receives notification of requested changes
2. Trainer opens bundle editor
3. Trainer sees manager's comments displayed
4. Trainer adds another product as requested
5. Trainer makes other adjustments based on feedback

**Expected Outcome:** Bundle is updated with additional products

---

#### Step 2.4: Trainer Resubmits Bundle for Review

**Actor:** Trainer  
**Screen:** Bundle Editor  
**Precondition:** Trainer has addressed feedback

The trainer resubmits the updated bundle.

**Actions:**
1. Trainer clicks "Submit for Review" button
2. System changes status to "pending_review"
3. System notifies managers of resubmission

**Expected Outcome:** Bundle is back in review queue

---

#### Step 2.5: Superuser Approves Bundle

**Actor:** Manager/Superuser  
**Screen:** Manager Dashboard → Approvals  
**Precondition:** Bundle is resubmitted for review

The manager approves the bundle for publication.

**Actions:**
1. Manager reviews updated bundle
2. Manager verifies all feedback was addressed
3. Manager clicks "Approve" button
4. System changes bundle status to "published"
5. System notifies trainer of approval
6. Bundle becomes visible in public catalog

**Expected Outcome:** Bundle is published and available for purchase

---

### Phase 3: Customer Invitation and Purchase

#### Step 3.1: Trainer Suggests Bundle to Customer

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Invite Client  
**Precondition:** Bundle is published

The trainer sends a personalized invitation to a potential customer.

**Actions:**
1. Trainer clicks "Invite Client" on dashboard
2. Trainer selects the approved bundle
3. Trainer enters customer email or generates shareable link
4. Trainer adds personal message (optional)
5. Trainer clicks "Send Invitation"
6. System creates invitation record with unique token
7. System sends email to customer (or trainer shares link)

**Expected Outcome:** Customer receives invitation link

---

#### Step 3.2: Customer Accepts Bundle and Proceeds to Payment

**Actor:** Customer  
**Screen:** Invitation Landing Page → Checkout  
**Precondition:** Customer has valid invitation link

The customer reviews and accepts the bundle offer.

**Actions:**
1. Customer clicks invitation link
2. System displays invitation landing page with:
   - Trainer profile and photo
   - Bundle details (title, description, image)
   - Included products with images
   - Included services (sessions, check-ins)
   - Goals addressed
   - Total price
   - Personal message from trainer
3. Customer clicks "Accept & Pay" button
4. System redirects to checkout/payment screen
5. Customer completes payment (mock for testing)
6. System creates order record
7. System creates subscription (if recurring)
8. System auto-creates product delivery records

**Expected Outcome:** Order is created, payment is processed, deliveries are scheduled

---

#### Step 3.3: Trainer is Notified of Customer Approval

**Actor:** Trainer  
**Screen:** Trainer Dashboard / Notifications  
**Precondition:** Customer has completed payment

The trainer receives notification of the new client.

**Actions:**
1. System sends push notification to trainer
2. Trainer sees notification: "New client! [Customer Name] accepted [Bundle Name]"
3. Trainer navigates to dashboard
4. Dashboard shows updated stats (new client, new order)
5. Trainer sees new deliveries in Deliveries tab
6. Trainer sees new client in Clients tab

**Expected Outcome:** Trainer is aware of new client and pending deliveries

---

### Phase 4: Product Delivery

#### Step 4.1: Trainer Delivers Products and Marks as Delivered

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Deliveries  
**Precondition:** Order exists with pending deliveries

The trainer fulfills the product delivery.

**Actions:**
1. Trainer navigates to Deliveries tab
2. Trainer sees pending deliveries for the new client
3. Trainer physically delivers products to customer
4. Trainer clicks "Mark Ready" when preparing
5. Trainer clicks "Mark Delivered" after handoff
6. System updates delivery status to "delivered"
7. System records delivery timestamp
8. System notifies customer of delivery

**Expected Outcome:** Delivery status is "delivered", customer is notified

---

#### Step 4.2: Customer Sees Product as Delivered

**Actor:** Customer  
**Screen:** Client Dashboard → Deliveries  
**Precondition:** Trainer has marked delivery as delivered

The customer views their delivery status.

**Actions:**
1. Customer receives push notification: "Your [Product Name] has been delivered!"
2. Customer opens app and navigates to Deliveries
3. Customer sees delivery with "Delivered" status
4. Customer has options: "Confirm Receipt" or "Report Issue"

**Expected Outcome:** Customer can see and act on delivered products

---

#### Step 4.3: Customer Reports Missing Product

**Actor:** Customer  
**Screen:** Client Dashboard → Deliveries  
**Precondition:** Delivery is marked as delivered

The customer reports an issue with the delivery.

**Actions:**
1. Customer clicks "Report Issue" on the delivery
2. System displays issue options:
   - Product damaged
   - Wrong product received
   - Product not received
   - Quality issue
   - Other
3. Customer selects "Product not received" or enters custom message
4. Customer adds comment: "You forgot to include the protein powder"
5. System updates delivery status to "disputed"
6. System notifies trainer of the issue

**Expected Outcome:** Delivery is marked as disputed, trainer is notified

---

#### Step 4.4: Trainer Apologizes and Delivers Missing Product

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Deliveries  
**Precondition:** Delivery has disputed status

The trainer resolves the issue.

**Actions:**
1. Trainer receives notification of disputed delivery
2. Trainer navigates to Deliveries tab
3. Trainer sees delivery with "Disputed" status and customer's comment
4. Trainer contacts customer to apologize (via Messages)
5. Trainer delivers the missing product
6. Trainer creates new delivery record for the missing item
7. Trainer marks new delivery as delivered
8. Customer confirms receipt of missing item

**Expected Outcome:** Issue is resolved, customer is satisfied

---

### Phase 5: Session Tracking

#### Step 5.1: Trainer Marks Session as Completed

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Calendar or Clients  
**Precondition:** Bundle includes sessions, client is active

The trainer records a completed training session.

**Actions:**
1. Trainer navigates to Calendar or Client detail
2. Trainer sees scheduled session with client
3. Trainer conducts the training session
4. Trainer clicks "Mark Complete" on the session
5. System increments session usage count
6. System updates remaining sessions display

**Expected Outcome:** Session is recorded, usage count is updated

---

#### Step 5.2: Trainer Views Bundle Status and Remaining Sessions

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Clients → Client Detail  
**Precondition:** Client has active subscription

The trainer monitors client progress.

**Actions:**
1. Trainer navigates to Clients tab
2. Trainer clicks on client to view detail
3. Trainer sees subscription status:
   - Bundle name and status (active/paused/cancelled)
   - Sessions: X of Y used (e.g., "3 of 12 sessions used")
   - Progress bar showing completion percentage
   - Next scheduled session
   - Delivery status for products
4. Trainer can schedule next session
5. Trainer can view session history

**Expected Outcome:** Trainer has full visibility into client's bundle status

---

## Implementation Checklist

### Bundle Creation & Editing
- [ ] Bundle templates for quick start
- [x] Bundle editor with tabs (Details, Services, Products, Goals)
- [x] Product selection from Shopify catalog
- [x] Auto-price calculation
- [x] Save as draft functionality
- [x] Submit for review workflow

### Bundle Review Workflow
- [x] Manager approvals screen
- [ ] Review comments/feedback system
- [ ] "Request Changes" action with comments
- [ ] "Changes Requested" status
- [x] Approve/Reject actions
- [ ] Resubmission workflow
- [x] Notification on status changes

### Customer Invitation & Purchase
- [x] Invite client screen
- [x] Invitation landing page with bundle preview
- [x] Accept invitation flow
- [ ] Payment integration (mock for testing)
- [x] Auto-create order on acceptance
- [ ] Auto-create delivery records on order
- [x] Notification to trainer on acceptance

### Product Delivery
- [x] Trainer deliveries screen
- [x] Mark ready / Mark delivered actions
- [x] Client deliveries screen
- [x] Confirm receipt action
- [x] Report issue action
- [x] Disputed status handling
- [ ] Messaging for issue resolution
- [ ] Create additional delivery for missing items

### Session Tracking
- [x] Session scheduling (Calendar)
- [x] Mark session complete
- [x] Session usage tracking (X of Y used)
- [x] Client detail with subscription status
- [x] Remaining sessions display
- [ ] Session history view

### Notifications
- [x] New order notification
- [x] Delivery status notifications
- [ ] Bundle approval/rejection notification
- [ ] Issue reported notification
- [ ] Session reminder notification

---

## Testing with Impersonation

To test this complete journey, use the **Coordinator Impersonation** feature:

1. **Login as Coordinator:** `coordinator@secretlab.com` / `supertest`
2. **Impersonate Trainer:** Click "Test As Trainer" to create and submit bundle
3. **End Impersonation:** Click "End Session" to return to coordinator
4. **Impersonate Manager:** Click "Test As Manager" to review and approve bundle
5. **Impersonate Trainer:** Send invitation to test client
6. **Impersonate Client:** Accept invitation and complete purchase
7. **Impersonate Trainer:** Mark deliveries and complete sessions
8. **Impersonate Client:** Confirm receipt or report issues

This allows complete end-to-end testing without needing multiple devices or accounts.

---

## Status Flow Diagrams

### Bundle Status Flow

```
[draft] → [pending_review] → [changes_requested] → [pending_review] → [published]
                          ↘                                        ↗
                            [rejected] ─────────────────────────────
```

### Delivery Status Flow

```
[pending] → [ready] → [scheduled] → [out_for_delivery] → [delivered] → [confirmed]
                                                                    ↘
                                                                      [disputed] → [resolved]
```

### Subscription Status Flow

```
[active] ←→ [paused] → [cancelled]
         ↘           ↗
           [expired]
```

---

## References

- [LocoMotivate Product Delivery Journey](./PRODUCT_DELIVERY_JOURNEY.md)
- [Delivery Journey Gap Analysis](./DELIVERY_JOURNEY_GAP_ANALYSIS.md)
- [Expo SDK Documentation](../README.md)
