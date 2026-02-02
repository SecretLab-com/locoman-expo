# Trainer App – Dashboard Homepage Wireframe

## Purpose
Homepage dashboard for Personal Trainers using the platform to:
- Charge for or mark used a training sessions (tap-to-pay)
- Manage clients
- Sell products, bundles, and subscriptions
- Track revenue, payouts, and rewards status
 - Suggest bundles/products and invite clients (no direct purchasing)

Mental model:
**Status → Money → Clients → Actions → Growth**

---

## Screen: Trainer Dashboard (Mobile – Primary)

---

## 1. Header

**Component:** App Header  
**Position:** Fixed (Top)

**Elements:**
- Greeting (Hi {Trainer Name})
- Notifications icon
- Menu / Profile icon

```
┌────────────────────────────────────┐
│ 👋 Hi Jiri            🔔   ☰       │
│ Trainer Dashboard                  │
└────────────────────────────────────┘
```

---

## 2. Status & Rewards (Hero Section)

**Component:** Status Card  
**Priority:** Highest (Above the fold)

**Data Points:**
- Tier (Gold / Platinum / Diamond / Delta)
- Monthly points
- Progress to next tier
- Revenue share percentage
- Tier benefits
- Monthly reset countdown

```
┌────────────────────────────────────┐
│ 💎 DIAMOND STATUS                  │
│                                    │
│ Points this month: 4,820 pts       │
│ ──────────────────────────────── │
│ ████████████░░░░░░░ 80% → Next    │
│                                    │
│ Revenue share: 35%                 │
│ Bonuses active: ✔                 │
│                                    │
│ Resets in: 12 days                 │
│                                    │
│ [ View rewards → ]                 │
└────────────────────────────────────┘
```

---

## 3. Revenue Performance Snapshot

**Component:** Performance Card  
**Purpose:** High-level business overview

**Metrics:**
- Total revenue generated
- Trainer earnings
- Sales mix (sessions / products / subscriptions)
 - Sales performance by category (sessions / products / bundles)

```
┌────────────────────────────────────┐
│ 📊 Performance – This Month        │
│                                    │
│ Total sold:        £6,420          │
│ Your earnings:     £1,925          │
│                                    │
│ Sessions      ████▉                │
│ Products      ███▍                 │
│ Subscriptions ██▋                  │
│                                    │
│ [ View analytics → ]               │
└────────────────────────────────────┘
```

---

## 4. Balance & Payouts

**Component:** Balance Card  
**Purpose:** Cash clarity & trust

**Data:**
- Available balance
- Pending balance
- Last payout
- Next payout date

```
┌────────────────────────────────────┐
│ 💳 Balance                         │
│                                    │
│ Available:        £1,925           │
│ Pending:            £320           │
│                                    │
│ Last payout:  Jan 31 (£1,480)      │
│ Next payout:  Feb 28               │
│                                    │
│ ✔ Payouts on track                 │
└────────────────────────────────────┘
```

---

## 5. Clients

**Component:** Client List (Horizontal Scroll)

**Client Card Data:**
- Avatar / initials
- Name
- Programme tag (Hyrox / Marathon / Strength)

```
┌────────────────────────────────────┐
│ 👥 My Clients            + Add     │
│                                    │
│ [ 🧍‍♂️ Alex ] [ 🧍‍♀️ Sam ] [ 🧍 Tom ] │
│  Hyrox       Marathon    Strength │
│                                    │
│ → Swipe to see more                │
└────────────────────────────────────┘
```

---

## 6. Quick Actions

**Component:** Primary Action Buttons  
**Purpose:** Fast monetisation

**Actions:**
- Charge Session
- Create Bundle
- Create Subscription
- Manage Sessions
- Invite Client
- Messages

```
┌────────────────────────────────────┐
│ ⚡ Quick Actions                   │
│                                    │
│ [ 💳 Charge Session ]              │
│ [ 📦 Create Bundle ]               │
│ [ 🔁 Create Subscription ]         │
│ [ 🗓 Manage Sessions ]             │
└────────────────────────────────────┘
```

---

## 7. Services Management

**Component:** Services List

**Services Examples:**
- 1:1 PT Sessions
- Group Training
- Online Coaching
- Assessments

```
┌────────────────────────────────────┐
│ 🛠 My Services                     │
│                                    │
│ • 1:1 PT Sessions                  │
│ • Group Training                   │
│ • Online Coaching                  │
│ • Assessments                      │
│                                    │
│ [ Edit services → ]                │
└────────────────────────────────────┘
```

---

## 8. Trending & Promotions

**Component:** Promotional Banner / Carousel  
**Purpose:** Drive upsell and behaviour

**Examples:**
- Trending bundles
- Bonus point campaigns
- New approved products
 - Trending promotions pushed to trainers to sell to clients

---

## Implementation Notes (In App)

The trainer dashboard screen has been updated to reflect the above sections:
- Status tier (Delta supported)
- Sales performance by category
- Balance & payouts
- Clients preview
- Quick actions
- Manage my services
- Trending products/bundles/promotions

```
┌────────────────────────────────────┐
│ 🔥 Trending for You                │
│                                    │
│ 🧃 Hyrox Recovery Bundle            │
│ “Top seller this week”             │
│ +300 pts per sale                  │
│                                    │
│ [ Assign to client ]               │
└────────────────────────────────────┘
```

---

## 9. Bottom Navigation

**Component:** Tab Bar (Fixed Bottom)

**Tabs:**
- Home
- Clients
- Pay
- Analytics
- Alerts

```
┌────────────────────────────────────┐
│ 🏠 Home  👥 Clients  💳 Pay         │
│ 📊 Stats  ⚙ Settings               │
└────────────────────────────────────┘
```

---

## Design Notes

- Mobile-first (iOS / Android)
- Status and money visible without scrolling
- One primary CTA per section
- Tier colour themes:
  - Gold → Warm gold
  - Platinum → Silver / steel
  - Diamond → Deep blue / purple
