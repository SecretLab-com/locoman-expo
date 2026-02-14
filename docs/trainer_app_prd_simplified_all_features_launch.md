# Product Requirements Document (PRD)

## Product: Trainer App (Working name: LocoMotive / Bright.Coach)

## Goal: Launch with all core features **present but simplified**, optimised for fast earnings and low cognitive load

## Owner: Product

## Stakeholders: Engineering, Design, Ops, Payments

## Version: v1.0 (Launch)

---

## 1. Product Vision

Build the simplest possible app that enables trainers to:

1. Invite clients
2. Sell sessions, bundles, or subscriptions
3. Get paid quickly and confidently
4. Feel rewarded for growth

**Key principle:**

> Everything exists, but nothing shouts.

Advanced capability must be *discoverable*, not *demanding*.

---

## 2. Success Metrics (Launch)

Primary (must move in first 14 days):

- % of trainers who invite ≥1 client
- % of trainers who create ≥1 offer
- % of trainers who receive ≥1 payment
- Time to first payment (median)

Secondary:

- Repeat payments per trainer
- Trainer retention (Day 7 / Day 30)
- Support tickets per active trainer

---

## 3. Core User Persona

**Primary:** Independent Personal Trainer / Coach

- Time-poor
- Not tech-focused
- Motivated by earnings, not dashboards
- Wants to look professional in front of clients

Mental model:

> "Help me make money without making me feel stupid."

---

## 4. Information Architecture (Simplified)

Bottom navigation (fixed):

- Home
- Clients
- Get Paid
- Rewards
- More

Advanced analytics, configuration, and admin live under **More**.

---

## 5. Home Screen (Core Surface)

### Purpose

Answer one question:

> What should I do next to earn money?

### Components

**Header**

- Greeting: “Hi, {{First name}} 👋”
- Subtext: “Let’s get you paid.”

**Hero Card (Primary)**
Dynamic state-driven messaging:

- No clients:

  - Title: “You’re 2 steps away from your first payout”
  - CTA: Invite a client

- Client exists, no offer:

  - Title: “Create your first offer”
  - CTA: Create offer

- Offer exists, no payment:

  - Title: “Share your payment link”
  - CTA: Get paid

- Payment exists:

  - Title: “You’ve earned £{{amount}}”
  - CTA: View payouts

**Progress Indicator**
3-step visual only showing the *next* step:

1. Invite client
2. Create offer
3. Get paid

**Earnings Preview (Hidden until payment)**

- Total earned
- Next payout date

---

## 6. Clients

### Purpose

Manage people, not CRM complexity.

### Features (Simplified)

- Client list (Active / Inactive)
- Invite client (email / link / QR)
- Client detail:
  - Name
  - Active offers
  - Payment history

### Explicit exclusions (v1)

- Notes
- Tags
- Segmentation

---

## 7. Offers (Unifying Sessions, Bundles, Subscriptions)

### Concept

All monetisation methods are abstracted into **Offers**.

### Offer Types (Single creation flow)

- One-off session
- Multi-session package
- Product bundles

### Creation Flow (Max 5 steps)

1. Offer type
2. Price
3. What’s included
4. Payment type (one-off / recurring)
5. Publish

### Defaults

- Pre-filled pricing suggestions
- Simple language (no billing jargon)

---

## 8. Payments / Get Paid

### Purpose

Absolute clarity, confidence, and speed — online or in‑person.

### Payment Modes (Two equal paths)

1. **Instant Tap to Pay (In‑person)**
2. **Payment Link (Remote)**

Both routes feed the same balances, payouts, rewards, and analytics.

---

### 8.1 Instant Tap to Pay ("Cash App" for Trainers)

**Concept**
A dead‑simple, Stripe‑Terminal‑style flow for in‑person payments.

> Trainer enters amount → says what it’s for → client taps phone → paid.

No clients, offers, or setup required.

**Primary Use Cases**
- Ad‑hoc PT sessions
- Walk‑up training
- Class top‑ups
- Last‑minute charges

**Flow (Max 3 steps)**
1. Enter amount (£)
2. Optional description (e.g. “PT session”, “Class drop‑in”)
3. Client taps phone (Tap on Phone)

**Success State**
- “Payment received” confirmation
- Amount added instantly to balance

**UI Placement**
- Home → Secondary CTA: “Take payment now”
- Get Paid → Primary option

**Safeguards**
- Default description if empty (e.g. “Training session”)
- Clear confirmation screen before tap

---

### 8.2 Payment Link (Remote)

**Purpose**
Get paid when client isn’t physically present.

**Flow**
- Enter amount OR select offer
- Optional message
- Share link (SMS / WhatsApp / QR)

---

### Status Model (Only 3 states)

- Awaiting payment
- Paid
- Paid out

---

### Payment History

- Chronological list
- Clear status labels
- Tap‑to‑pay and link payments visually differentiated
- No test or duplicate data in production

---

## 9. Payouts


### Display

- Available balance
- Pending balance
- Next payout date

### Copy

- “Payouts happen automatically — no action needed.”

---

## 10. Rewards (Points & Status)

### Purpose

Motivation without pressure.

### Visibility Rules

- Hidden until first payment
- Not shown on Home

### Status Naming

- Getting Started
- Growing
- Pro
- Elite

### Points System (Simplified)

Displayed as:

- “Earn points by training clients and selling more.”

Detailed breakdown expandable, not default.

---

## 11. Analytics (Present but Quiet)

### Location

More → Analytics

### Launch Scope

- Earnings over time
- Top offers

No conversion funnels, no charts on Home.

---

## 12. Onboarding (≤30 seconds)

### Screen 1 — Value

“Get paid by clients — without chasing invoices”

### Screen 2 — How it works

Invite → Offer → Get paid

### Screen 3 — Action

CTA: Invite your first client

Skips dashboard entirely.

---

## 13. Empty States (Mandatory)

Every empty state must:

1. Explain why it’s empty
2. Tell user what to do next
3. Include a CTA

Example:
“No offers yet — create one to start earning.”

---

## 14. Non‑Goals (Explicit)

- Becoming a full trainer CRM
- Competing with scheduling tools
- Deep financial reporting

---

## 15. Launch Checklist

-

---

## 16. Product Mantra

> Simple beats powerful.
> Confidence beats features.
> Money first, everything else second.

---

END PRD

