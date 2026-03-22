# Bundle-to-Delivery Customer Journey Update to include trainer-assisted sales flow

**Version:** 1.2  
**Author:** Manus AI  
**Last Updated:** March 2026

---

## Overview

This document describes the complete end-to-end journey from bundle creation by a trainer through product delivery to a customer. It now includes:
- the original bundle review/purchase journey
- a trainer-assisted sales flow where a trainer builds a customer-specific `Saved Cart` or `Custom Bundle`
- a trainer-attributed storefront journey where accepted customers shop independently but purchases are attributed back to their trainer for commission and brand bonuses

Terminology used in this document:
- **Bundle** = a reusable, more static offer/template that can be published and reused across customers
- **Saved Cart / Custom Bundle** = a customer-specific proposed selection assembled by a trainer for one customer's needs, timing, and logistics
- **Trainer Attribution** = the tracking relationship between a customer and a trainer that ensures any Shopify purchase made by that customer earns the trainer a commission and any applicable brand/bonus rewards
- **My Store Link** = a unique, shareable storefront URL on the trainer's profile that attributes any customer who shops through it to that trainer

---

## Actors

| Actor | Role | Description |
|-------|------|-------------|
| **Trainer** | Service Provider | Creates bundles, assembles saved carts/custom bundles, delivers products, conducts sessions |
| **Manager/Superuser** | Administrator | Reviews and approves bundles, manages platform |
| **Customer/Client** | Consumer | Existing or new client who purchases bundles, receives products and sessions |
| **Coordinator** | Super Admin | Can impersonate any user for testing |

---

## Journey Steps

### Phase 0: Assisted Plan Building With Existing Customer

#### Step 0.1: Existing Customer Meets With Trainer

**Actor:** Trainer + Existing Customer  
**Screen:** Trainer Dashboard → Shopping Interface / Bundle Builder  
**Precondition:** Customer already exists in the trainer's client base or is known to the trainer

The trainer is physically or virtually with a customer and wants to build a customer-specific plan around real goals, timing, and logistics.

**Actions:**
1. Trainer opens the shopping interface while discussing goals with the customer
2. Trainer captures the customer's unique needs, timing constraints, and budget
3. Trainer identifies a suitable published bundle as the foundation of the plan
4. Trainer browses products in the shopping interface on the customer's behalf
5. Trainer adds several catalog products and any necessary custom products

**Expected Outcome:** A customer-specific cart/plan is assembled by the trainer in real time

---

#### Step 0.2: Trainer Builds Proposed Plan With Auto-Projected Timeline

**Actor:** Trainer  
**Screen:** Shopping Interface → Cart / Invite Flow  
**Precondition:** Trainer has selected a published bundle and products

The trainer turns the selected published bundle and products into a customer-specific `Saved Cart` / `Custom Bundle`, including expected timing. The timeline should be mostly automatic: the trainer answers simple cadence questions and the system projects the schedule from the selected bundle and products.

**Actions:**
1. Trainer selects the published bundle, additional products, and custom products for the customer
2. Trainer sets the proposed start date
3. System asks a simple cadence question such as:
   - Weekly
   - 2 times a week
   - 3 times a week
   - Daily
4. Trainer selects the cadence that best matches the customer's needs
5. System projects the training/session calendar automatically from the selected cadence and start date
6. System projects delivery timing automatically from the products and bundle contents in the saved cart / custom bundle
7. System calculates the proposed total price
8. Trainer reviews the projected plan with the customer before sending

**Expected Outcome:** A customer-specific saved cart / custom bundle exists with the base bundle, selected products, start date, and system-projected training and delivery expectations

---

#### Step 0.3: Trainer Sends Customer Invitation to Checkout

**Actor:** Trainer  
**Screen:** Invite Client / Checkout Invite Flow  
**Precondition:** Proposed plan is complete

The trainer sends the proposed plan to the customer for approval and payment.

**Actions:**
1. Trainer chooses the target customer
2. System packages the saved cart / custom bundle, including the selected base bundle, products, custom products, total price, start date, cadence, projected calendar, and projected delivery dates into an invitation
3. Trainer optionally adds a personal note
4. Trainer sends the invitation by email and/or in-app alert

**Expected Outcome:** Customer receives a personalized plan invite linked to checkout

---

### Phase 0b: Trainer-Attributed Independent Shopping

#### Step 0b.1: Trainer Shares Store Link With Customer

**Actor:** Trainer
**Screen:** Trainer Profile → My Store Link
**Precondition:** Trainer has an active profile

Every trainer has a unique `My Store Link` visible on their profile with a share button next to it. This link points to the platform storefront with the trainer's attribution code embedded.

**Actions:**
1. Trainer navigates to their profile
2. Trainer sees "My Store Link" with their unique URL (e.g., `bright.coach/shop?ref=trainer-slug`)
3. Trainer taps the share button next to the link
4. System opens the native share sheet or copies the link to clipboard
5. Trainer sends the link to any customer via text, email, social media, or in person

**Expected Outcome:** Customer receives a storefront link that is attributed to the trainer

---

#### Step 0b.2: Customer Accepts Invitation and Becomes Attributed

**Actor:** Customer
**Screen:** Invitation acceptance or store link landing
**Precondition:** Customer has received a trainer invitation or store link

When a customer accepts a trainer invitation (bundle, saved cart, or direct invite) or opens a trainer's store link, the system establishes a trainer attribution relationship.

**Actions:**
1. Customer accepts an invitation from a trainer, OR clicks a trainer's My Store Link
2. System records the trainer as the attributed trainer for this customer
3. Attribution persists across future independent purchases by this customer
4. If the customer has multiple trainers, the system uses the **most recent interaction**: the trainer they most recently purchased a bundle through, accepted an invite from, or whose store link they most recently used

**Expected Outcome:** Customer is attributed to the trainer for commission and bonus tracking

---

#### Step 0b.3: Customer Shops Independently in the Store

**Actor:** Customer
**Screen:** Storefront / Products / Checkout
**Precondition:** Customer has an active trainer attribution

The customer shops freely in the platform storefront. They are not building a saved cart with the trainer present; they are browsing and buying on their own.

**Actions:**
1. Customer browses products in the storefront
2. Customer adds items to cart and proceeds to checkout
3. Customer completes payment
4. System attributes the purchase to the customer's current trainer
5. System calculates trainer commission based on product/bundle-level commission rate (default 10%, configurable per product and per bundle)
6. System applies any brand bonus points or sponsored product bonuses associated with the purchase to the attributed trainer

**Expected Outcome:** Trainer earns commission and applicable bonuses on the customer's independent purchase

---

#### Step 0b.4: Trainer Receives Attribution Revenue

**Actor:** Trainer
**Screen:** Trainer Dashboard / Earnings / Get Paid
**Precondition:** Attributed customer has made a purchase

**Actions:**
1. System notifies trainer of attributed purchase: "Your client [Name] purchased [Product] - you earned $X commission"
2. Trainer sees attributed earnings in their earnings/get-paid screen
3. Commission and bonus amounts are tracked per order and per product line item
4. If a brand bonus or sponsored product bonus applies, it is added on top of the base commission

**Expected Outcome:** Trainer has full visibility into attributed revenue from independent customer purchases

---

#### Trainer Attribution Rules

| Rule | Behavior |
|------|----------|
| **Default commission** | 10% of product sale price |
| **Per-product override** | Configurable commission rate per product (set by coordinator/manager) |
| **Per-bundle override** | Configurable commission rate per bundle (set by coordinator/manager) |
| **Brand bonus** | Additional bonus points or cash value tied to brand campaigns, applied to the attributed trainer |
| **Multiple trainers** | Customer is attributed to the trainer they most recently interacted with (most recent bundle purchase, invitation acceptance, or store link click) |
| **Attribution persistence** | Attribution persists until the customer interacts with a different trainer |
| **Store link attribution** | Clicking a trainer's My Store Link updates the customer's attribution to that trainer |

---

### Phase 1: Bundle Creation

#### Step 1.1: Trainer Creates Bundle from Template

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Bundles → New Bundle  
**Precondition:** Trainer is logged in with trainer role

The trainer navigates to their dashboard and selects "New Bundle" to create a new fitness bundle. They can optionally start from a template that pre-populates common configurations.

**Actions:**
1. Trainer clicks "New Bundle" button on dashboard
2. System displays the canonical bundle editor with tabs: Campaign, Details, Services, Products
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

#### Step 3.1: Trainer Sends Saved Cart / Custom Bundle to Customer

**Actor:** Trainer  
**Screen:** Trainer Dashboard → Invite Client  
**Precondition:** A customer-specific saved cart / custom bundle has been prepared, optionally using a published bundle as its base

The trainer sends a personalized invitation to the customer for the saved cart / custom bundle they built together.

**Actions:**
1. Trainer clicks "Invite Client" from the saved cart / custom bundle flow
2. Trainer confirms the saved cart / custom bundle contents, including any published bundle used as the base
3. Trainer enters customer email or generates shareable link
4. Trainer adds personal message (optional)
5. Trainer clicks "Send Invitation"
6. System creates invitation record with unique token
7. System sends email to customer (or trainer shares link)

**Expected Outcome:** Customer receives an invitation link to review the saved cart / custom bundle

---

#### Step 3.2: Customer Accepts Saved Cart / Custom Bundle and Proceeds to Payment

**Actor:** Customer  
**Screen:** Invitation Landing Page → Checkout  
**Precondition:** Customer has valid invitation link

The customer reviews and accepts the customer-specific saved cart / custom bundle offer.

**Actions:**
1. Customer clicks invitation link
2. System displays invitation landing page / checkout pre-cart with:
   - Trainer profile and photo
   - Base bundle details (if a published bundle was used)
   - Included products with images
   - Any custom products added by the trainer
   - Included services (sessions, check-ins)
   - Goals addressed
   - Total price
   - Proposed start date
   - Projected delivery dates
   - Projected calendar / schedule context generated from cadence
   - Personal message from trainer
3. Customer clicks through to checkout
4. Customer reviews the cart contents assembled by the trainer
5. Customer may edit the cart before payment, including removing the base bundle and any discounts associated with it
6. System automatically recalculates projected training dates, projected delivery dates, and pricing whenever the cart is modified
7. System tracks cart changes relative to the trainer's proposed plan
8. Customer clicks "Pay"
9. Customer completes payment (mock for testing)
10. System creates order record
11. System creates subscription (if recurring)
12. System prepares fulfillment payloads for logistics

**Expected Outcome:** Order is created, payment is processed, and the final purchased cart is locked for fulfillment

---

#### Step 3.3: Trainer is Notified of Customer Approval and Cart Changes

**Actor:** Trainer  
**Screen:** Trainer Dashboard / Notifications  
**Precondition:** Customer has completed payment

The trainer receives notification that the customer paid, and is told whether the customer changed the proposed cart before purchase.

**Actions:**
1. System sends push notification to trainer
2. Trainer sees notification: "Customer paid for saved cart / custom bundle"
3. If the customer edited the cart, system includes a summary of what changed:
   - products removed
   - products added
   - quantity changes
   - base bundle removed
   - discount changes caused by bundle removal
   - custom product changes
   - price delta
4. Trainer navigates to dashboard
5. Dashboard shows updated stats (new client, new order)
6. Trainer sees new deliveries in Deliveries tab
7. Trainer sees new client activity in Clients tab

**Expected Outcome:** Trainer is aware of payment completion, pending deliveries, and any cart differences from the original proposal

---

### Phase 4: Shopify Fulfillment and Product Delivery

#### Step 4.1: Paid Order Is Submitted to Shopify

**Actor:** System  
**Screen:** Backend fulfillment handoff / Shopify integration  
**Precondition:** Customer has paid successfully

After payment, the final cart is sent to Shopify so logistics and delivery can be managed through the commerce system.

**Actions:**
1. System converts the final purchased cart into a Shopify-compatible order payload
2. System includes catalog products, quantities, delivery details, and customer data
3. Custom products follow the existing application-side order and delivery direction already established in the codebase
4. System submits the order to Shopify
5. Shopify becomes the source of truth for logistics and shipment progress where applicable
6. System stores the Shopify order reference for reconciliation and support

**Expected Outcome:** A paid order is handed off to Shopify for logistics and downstream delivery operations

---

#### Step 4.2: Trainer Delivers Products and Marks as Delivered

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

#### Step 4.3: Customer Sees Product as Delivered

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

#### Step 4.4: Customer Reports Missing Product

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

#### Step 4.5: Trainer Apologizes and Delivers Missing Product

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
  - Saved cart / custom bundle plan details and status
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
- [x] Bundle templates for quick start (`trpc.bundles.templates`, `campaignMode` template picker in bundle editor)
- [x] Bundle editor with tabs (Campaign, Details, Services, Products)
- [x] Product selection from Shopify catalog
- [x] Auto-price calculation
- [x] Save as draft functionality
- [x] Submit for review workflow

### Bundle Review Workflow
- [x] Manager approvals screen (`app/(manager)/approvals.tsx`)
- [x] Review comments/feedback system (single latest-comment model via `reviewComments` on bundle draft)
  - [ ] Threaded multi-comment review history UI (enhancement)
- [x] "Request Changes" action with comments (`admin.requestChanges` with `comments` input)
- [x] "Changes Requested" status (`changes_requested` in `bundle_status` enum, tab in approvals)
- [x] Approve/Reject actions
- [x] Resubmission workflow (`bundles.respondToReview` with `resubmit` flag)
- [x] Notification on status changes (push to trainer on approve/reject/request-changes)

### Customer Invitation & Purchase
- [x] Invite client screen
- [x] Invitation landing page with bundle preview
- [x] Accept invitation flow (bundle invites via `acceptInvitation`, proposal invites route to checkout)
- [x] Trainer-assisted cart proposal flow (`savedCartProposals` CRUD, `TrainerProposalBuilder` in cart)
- [x] Proposed start date and projected delivery dates (stored in `proposalSnapshot`, served via `catalog.invitation`)
  - [ ] Render start date and projected delivery dates on client-facing invite landing page
- [x] Simple cadence prompts (weekly, 2x/week, 3x/week, daily in trainer proposal builder)
- [x] Automatic calendar projection from cadence and start date (`buildProjectedSchedule` in `shared/saved-cart-proposal.ts`)
- [x] Automatic delivery-date projection from saved cart / custom bundle contents (`buildProjectedDeliveries`)
- [ ] Projected calendar rendered on client-facing invite landing page
- [x] Customer cart editing before payment (editable line items, qty, fulfillment, remove in proposal checkout)
- [x] Customer can remove the base bundle and related discounting before payment (clears `baseBundleDraftId`)
- [x] Recalculate timeline and delivery projection automatically after cart edits (`proposalPreview` recomputes via `buildSavedCartProposalSnapshot`)
- [x] Cart diff tracking versus trainer proposal (`diffProposalSnapshots` persisted as `cart_diff_json` on order)
- [x] Payment integration (Adyen payment links, mock mode via `MOCK_SHOPIFY`)
- [x] Auto-create order on payment (order created at checkout, Adyen webhook marks paid)
- [x] Auto-create delivery records on order (both `orders.create` and `orders.createFromProposal` create deliveries)
- [x] Notify trainer if customer modified the cart before paying (cart diff summary in push via `notifyTrainerAboutPaidProposalOrder`)
- [x] Notification to trainer on payment

### Product Delivery
- [x] Submit paid order to Shopify (`submitPaidOrderToShopify` in `server/_core/index.ts`)
- [x] Persist Shopify order reference for tracking (`shopifyOrderId` and `shopifyOrderNumber` on order row)
- [x] Trainer deliveries screen
- [x] Mark ready / Mark delivered actions
- [x] Client deliveries screen
- [x] Confirm receipt action
- [x] Report issue action
- [x] Disputed status handling
- [ ] Messaging thread for issue resolution (disputes update delivery rows but no dedicated message bridge)
- [x] Create additional delivery for missing items (API: `deliveries.createForOrder`)
  - [ ] Trainer UI for creating additional delivery from deliveries screen

### Session Tracking
- [x] Session scheduling (Calendar)
- [x] Mark session complete
- [x] Session usage tracking (X of Y used)
- [x] Client detail with subscription status
- [x] Remaining sessions display
- [ ] Session history view (dedicated list on client detail)

### Trainer Attribution and Independent Shopping
- [x] Trainer attribution model (dedicated `trainer_attributions` + `trainer_attribution_log` tables with source, timestamps, audit history)
- [x] My Store Link on trainer profile with unique attribution slug (`/shop/{username}` in trainer profile)
- [x] Share button next to My Store Link (native share sheet via `Share.share`)
- [x] Store link landing page sets trainer attribution on customer (`app/shop/[slug].tsx`)
- [x] Invitation acceptance sets trainer attribution on customer (`upsertAttribution` in `acceptInvitation` and `createFromProposal`)
- [x] Attribution updates to most-recent-interaction trainer when customer has multiple trainers (upsert on `customer_id` unique constraint)
- [x] Per-product configurable commission rate (default 10%) (`products.commission_rate` column)
- [x] Per-bundle configurable commission rate (default 10%) (`bundle_drafts.commission_rate` column)
- [x] Brand bonus / sponsored product bonus applied to attributed trainer on purchase (`createSponsoredProductBonuses` writes `trainer_earnings` with `earningType: "bonus"`)
- [x] Commission calculation on independent customer purchases (`createAttributedCommissions` in paid-order pipeline)
- [x] Attributed purchase notification to trainer (`notifyTrainerAboutAttributedPurchase` push notification)
- [x] Attributed earnings visible in trainer earnings/get-paid screen (commission rows in `trainer_earnings`, distinct icon/color in earnings UI)

### Notifications
- [x] New order notification
- [x] Delivery status notifications
- [x] Cart modified notification to trainer (via `notifyTrainerAboutPaidProposalOrder` cart-diff summary push)
- [x] Attributed purchase notification to trainer (`notifyTrainerAboutAttributedPurchase` push)
- [x] Bundle approval/rejection notification (push to trainer on approve: `"Bundle approved"`, reject: `"Bundle needs revision"`)
- [ ] Issue reported notification (currently badge-count only, no targeted trainer push)
- [ ] Session reminder notification (helper exists in `lib/notifications.ts` but not wired from server/session flows)

---

## Testing with Impersonation

To test this complete journey, use the **Coordinator Impersonation** feature:

1. **Login as Coordinator:** `coordinator@secretlab.com` / `supertest`
2. **Impersonate Trainer:** Click "Test As Trainer" to create and submit the reusable standard bundle
3. **End Impersonation:** Click "End Session" to return to coordinator
4. **Impersonate Manager:** Click "Test As Manager" to review and approve the standard bundle. This approval is performed once for the reusable bundle, not once per customer.
5. **Impersonate Trainer:** Build a saved cart / custom bundle for the customer using the approved standard bundle as a base if desired. This customer-specific plan does not require separate manager approval.
6. **Impersonate Client:** Open the invite, edit the cart if needed, verify projections recalculate, and complete purchase
7. **Impersonate Trainer:** Verify payment notification, inspect any cart diff summary, then monitor deliveries
8. **Impersonate Trainer:** Mark deliveries and complete sessions
9. **Impersonate Client:** Confirm receipt or report issues
10. **Impersonate Trainer:** Copy "My Store Link" from profile and share it
11. **Impersonate Client:** Open the trainer's store link, browse products independently, and complete a purchase
12. **Impersonate Trainer:** Verify attributed purchase notification and commission earnings appear in get-paid/earnings

This allows complete end-to-end testing without needing multiple devices or accounts.

---

## Status Flow Diagrams

### Bundle Status Flow

```
[draft] → [pending_review] → [changes_requested] → [pending_review] → [published]
                          ↘                                        ↗
                            [rejected] ─────────────────────────────
```

For trainer-assisted checkout proposals, the commercial flow should additionally contemplate:

```
[proposal_created] → [invited] → [checkout_opened] → [cart_modified?] → [paid] → [submitted_to_shopify]
```

### Trainer Attribution Flow

```
[invite_accepted | store_link_clicked] → [attributed_to_trainer]
                                              ↓
                                   [customer_purchases_independently]
                                              ↓
                              [commission_calculated + bonus_applied]
                                              ↓
                                   [trainer_notified + earnings_recorded]
```

If the customer interacts with a different trainer (new invite, new store link, new bundle purchase), attribution updates:

```
[attributed_to_trainer_A] → [interacts_with_trainer_B] → [attributed_to_trainer_B]
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
