# LocoMotivate User Journey Audit

This document audits all user journeys to verify they work end-to-end.

## Journey 1: Shopper Discovery & Purchase

**Goal:** A new user discovers the app, browses bundles, and makes a purchase.

### Steps:
1. [ ] User opens app → Sees catalog/landing page
2. [ ] User browses bundle grid → Can filter/search
3. [ ] User taps bundle card → Bundle detail opens
4. [ ] User views bundle details (products, services, trainer info)
5. [ ] User taps "Add to Cart" → Item added with feedback
6. [ ] User navigates to Cart → Reviews items
7. [ ] User adjusts quantities → Totals update
8. [ ] User taps Checkout → Checkout flow starts
9. [ ] User completes payment → Order confirmation shown
10. [ ] User receives order confirmation notification

### Current Status: TO AUDIT

---

## Journey 2: Trainer Bundle Creation & Approval

**Goal:** A trainer creates a bundle, submits for review, and gets it published.

### Steps:
1. [ ] Trainer logs in → Dashboard loads
2. [ ] Trainer taps "Bundles" tab → Bundle list shows
3. [ ] Trainer taps "Create Bundle" → Bundle editor opens
4. [ ] Trainer fills in details (title, description, goals)
5. [ ] Trainer adds products from catalog
6. [ ] Trainer configures services (sessions, check-ins)
7. [ ] Trainer sets pricing
8. [ ] Trainer taps "Save Draft" → Draft saved
9. [ ] Trainer taps "Submit for Review" → Status changes to pending_review
10. [ ] Manager sees bundle in approvals queue
11. [ ] Manager approves bundle → Status changes to published
12. [ ] Trainer receives notification of approval
13. [ ] Bundle appears in public catalog

### Current Status: TO AUDIT

---

## Journey 3: Client Invitation & Onboarding

**Goal:** A trainer invites a client to join a bundle, client accepts and becomes active.

### Steps:
1. [ ] Trainer opens bundle → Taps "Invite Client"
2. [ ] Trainer enters client email/phone
3. [ ] Trainer adds personal message
4. [ ] Trainer taps "Send Invitation" → Invitation created
5. [ ] Client receives invitation link
6. [ ] Client opens link → Invitation landing page shows
7. [ ] Client sees bundle preview (products, services, goals)
8. [ ] Client taps "Accept" → Payment flow starts
9. [ ] Client completes payment → Order created
10. [ ] Delivery records auto-created for products
11. [ ] Client redirected to dashboard
12. [ ] Trainer receives notification of acceptance

### Current Status: TO AUDIT

---

## Journey 4: Product Delivery Flow

**Goal:** A product is delivered from trainer to client with confirmation.

### Steps:
1. [ ] Order placed → Delivery records created automatically
2. [ ] Trainer sees pending deliveries in Deliveries tab
3. [ ] Trainer prepares product → Taps "Mark Ready"
4. [ ] Trainer meets client → Taps "Mark Delivered"
5. [ ] Client sees delivery in their Deliveries screen
6. [ ] Client receives notification of delivery
7. [ ] Client taps "Confirm Receipt" → Delivery confirmed
8. [ ] OR Client taps "Report Issue" → Dispute flow starts
9. [ ] If disputed, trainer receives notification
10. [ ] Messaging available for resolution

### Current Status: TO AUDIT

---

## Journey 5: Session Tracking

**Goal:** A trainer schedules and completes sessions with a client.

### Steps:
1. [ ] Trainer opens client detail → Sees subscription info
2. [ ] Trainer taps Calendar → Calendar view opens
3. [ ] Trainer schedules session → Session created
4. [ ] Client sees upcoming session in dashboard
5. [ ] Session time arrives → Both parties notified
6. [ ] Trainer marks session complete → Usage updated
7. [ ] Client sees updated session count (X of Y used)
8. [ ] When all sessions used → Renewal prompt shown

### Current Status: TO AUDIT

---

## Journey 6: Manager Approval Workflow

**Goal:** A manager reviews and approves/rejects bundles and ad partnerships.

### Steps:
1. [ ] Manager logs in → Dashboard shows pending counts
2. [ ] Manager taps "Approvals" → Approval queue shows
3. [ ] Manager taps bundle → Detail view opens
4. [ ] Manager reviews bundle details
5. [ ] Manager taps "Approve" → Bundle published
6. [ ] OR Manager taps "Request Changes" → Adds comment
7. [ ] Trainer receives notification with feedback
8. [ ] Trainer edits bundle → Resubmits
9. [ ] Manager sees resubmission → Reviews again

### Current Status: TO AUDIT

---

## Journey 7: Coordinator Impersonation

**Goal:** A coordinator tests the app as different user roles.

### Steps:
1. [ ] Coordinator logs in → Coordinator dashboard shows
2. [ ] Coordinator searches for user → User list shows
3. [ ] Coordinator taps "Impersonate" → Becomes that user
4. [ ] Impersonation banner shows at top
5. [ ] Coordinator navigates app as that user
6. [ ] Coordinator taps "End Impersonation" → Returns to coordinator
7. [ ] Impersonation logged in activity log

### Current Status: TO AUDIT

---

## Journey 8: Messaging

**Goal:** A client and trainer communicate through in-app messaging.

### Steps:
1. [ ] Client opens Messages → Conversation list shows
2. [ ] Client taps trainer conversation → Thread opens
3. [ ] Client types message → Taps send
4. [ ] Message appears in thread
5. [ ] Trainer receives notification
6. [ ] Trainer opens Messages → Sees unread indicator
7. [ ] Trainer reads message → Unread cleared
8. [ ] Trainer replies → Client receives notification

### Current Status: TO AUDIT

---

## Audit Checklist

| Journey | Status | Blocking Issues |
|---------|--------|-----------------|
| Shopper Discovery & Purchase | ⏳ | |
| Trainer Bundle Creation | ⏳ | |
| Client Invitation | ⏳ | |
| Product Delivery | ⏳ | |
| Session Tracking | ⏳ | |
| Manager Approval | ⏳ | |
| Coordinator Impersonation | ⏳ | |
| Messaging | ⏳ | |

Legend: ✅ Working | ⏳ To Audit | ❌ Broken | ⚠️ Partial
