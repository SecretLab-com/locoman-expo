# LocoMotivate Trainer Rewards Program

**Version:** 2.0 (Expo Mobile)  
**Last Updated:** January 2026  
**Author:** Manus AI

> **Note:** Based on initial React implementation at: https://github.com/SecretLab-com/locoman
> 
> This mobile app version is built with **Expo SDK 54**, **React Native**, and **TypeScript**.

---

## Executive Summary

The LocoMotivate Rewards program is a Delta SkyMiles-inspired loyalty system designed to incentivize trainer performance, reward consistent engagement, and create a clear path to increased earnings. Trainers earn points through sales, client engagement, and platform activities, progressing through status tiers that unlock enhanced commission rates, exclusive benefits, and recognition.

---

## Status Tiers

The program features four status tiers, each with progressively better benefits. Status is determined by points earned within a rolling 12-month period.

| Tier | Points Required | Commission Bonus | Benefits |
|------|-----------------|------------------|----------|
| **Bronze** | 0 - 4,999 | Base Rate (10%) | Standard platform access |
| **Silver** | 5,000 - 14,999 | +2% (12% total) | Priority support, monthly insights report |
| **Gold** | 15,000 - 29,999 | +4% (14% total) | Featured trainer badge, early access to new features |
| **Platinum** | 30,000+ | +6% (16% total) | Premium placement, exclusive events, dedicated account manager |

### Status Display

The trainer dashboard prominently displays current status with a progress bar showing advancement toward the next tier. The display includes:

- Current tier badge with visual indicator
- Points earned this year
- Points needed for next tier
- Projected status based on current trajectory
- Status expiration date (rolling 12-month window)

---

## Points System

### Base Earning Rate

The fundamental earning structure follows a simple formula:

> **£1 in revenue = 1 Point**

This applies to all bundle sales attributed to the trainer, calculated on the gross transaction amount before platform fees.

### Bonus Point Opportunities

Trainers can accelerate their point accumulation through various platform activities:

| Activity | Points Earned | Frequency |
|----------|---------------|-----------|
| First bundle sale of the month | 500 bonus | Monthly |
| New client acquisition | 250 per client | Per occurrence |
| Client retention (6+ months) | 100 per client | Monthly |
| Upselling via vending machine (trainer code) | 2x points on sale | Per transaction |
| Bundle review rating ≥4.5 stars | 50 per review | Per review |
| Completing platform training modules | 200 per module | Per completion |
| Referring a new trainer | 1,000 | Per successful referral |
| Achieving monthly sales target | 500 | Monthly |
| Perfect delivery completion rate | 300 | Monthly |
| **Ad Space Sale - Bronze Package** | 500 | Per sale |
| **Ad Space Sale - Silver Package** | 1,000 | Per sale |
| **Ad Space Sale - Gold Package** | 2,000 | Per sale |
| **Ad Space Sale - Platinum Package** | 5,000 | Per sale |
| Ad space renewal (existing client) | 250 bonus | Per renewal |

### Vending Machine Upselling

When clients purchase products from LocoMotivate vending machines using their trainer's code, the trainer receives:

1. **Double points** on the transaction value
2. **Standard commission** on the product sale
3. **Attribution credit** for client engagement metrics

This incentivizes trainers to promote vending machine usage and maintain ongoing client relationships beyond scheduled sessions.

### Local Business Ad Space Sales

Trainers can earn significant bonus points by selling advertising space to local businesses. This creates a partnership ecosystem where trainers leverage their community connections to bring local sponsors onto the platform.

#### Ad Space Packages

| Package | Monthly Fee | Trainer Commission | Bonus Points | Placement |
|---------|-------------|-------------------|--------------|----------|
| **Bronze** | £99/month | 15% (£14.85) | 500 | Bundle sidebar, 1 location |
| **Silver** | £249/month | 18% (£44.82) | 1,000 | Bundle sidebar + vending screen, 3 locations |
| **Gold** | £499/month | 20% (£99.80) | 2,000 | Premium placement, all locations, featured banner |
| **Platinum** | £999/month | 25% (£249.75) | 5,000 | Exclusive category sponsor, all placements, co-branded content |

#### How It Works

1. **Trainer identifies local business** - Gyms, supplement shops, physiotherapists, sports retailers, healthy cafes, etc.
2. **Trainer pitches ad partnership** - Using provided sales materials and rate cards
3. **Business signs up** - Through trainer's unique referral link
4. **Trainer earns commission + points** - Monthly recurring commission plus one-time bonus points
5. **Renewal bonuses** - 250 bonus points for each successful renewal

#### Ad Placement Locations

| Location | Description | Visibility |
|----------|-------------|------------|
| **Bundle Sidebar** | Appears alongside bundle details when clients browse | High |
| **Vending Machine Screen** | Digital display ads on LocoMotivate vending machines | Very High |
| **Trainer Profile** | Sponsored section on trainer's public landing page | Medium |
| **Email Newsletters** | Featured sponsor in client communications | Medium |
| **Receipt/Confirmation** | Logo on purchase confirmations | Low |

#### Eligible Business Categories

- Sports nutrition & supplements
- Fitness equipment & apparel
- Physiotherapy & sports medicine
- Healthy restaurants & meal prep
- Sports retailers
- Wellness & recovery services (massage, cryotherapy)
- Local gyms & fitness studios
- Health insurance providers
- Sports events & competitions

#### Ad Space Sales Tracking

The trainer dashboard includes an "Ad Partnerships" section showing:

- Active ad partnerships and their status
- Monthly recurring commission from ads
- Pending ad proposals
- Renewal dates and reminders
- Total ad revenue generated

---

## Trainer Dashboard Specifications

### Header Section

The dashboard header displays at-a-glance status information:

```
┌─────────────────────────────────────────────────────────────────────┐
│ LocoMotivate Rewards                                                │
│                                                                     │
│ [PLATINUM BADGE]  Sarah Johnson                                     │
│                                                                     │
│ 32,450 Points                          Next Tier: N/A (Max Status)  │
│ ████████████████████████████████████████ 100%                       │
│                                                                     │
│ Status valid through: December 2026                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Financial Summary Cards

Four primary metric cards display key financial data:

| Card | Description | Calculation |
|------|-------------|-------------|
| **Total Revenue This Month** | Gross sales attributed to trainer | Sum of all bundle sales (before fees) |
| **Total Income This Month** | Net earnings after commission calculation | Product commissions + Service revenue |
| **Points Earned This Month** | Loyalty points accumulated | Base points + Bonus points |
| **Commission Rate** | Current effective rate | Base (10%) + Tier bonus + SPF bonuses |

### Transaction List

A comprehensive transaction history with the following columns:

| Column | Description |
|--------|-------------|
| **Date** | Transaction timestamp |
| **Client Name** | Purchaser name (linked to client profile) |
| **Bundle Name** | Bundle title purchased |
| **Gross Amount** | Total transaction value |
| **Your Income** | Trainer's earnings from this sale |
| **Points Earned** | Loyalty points from transaction |
| **Statement** | Download PDF button |

Each row is clickable to expand detailed breakdown:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Transaction Detail: #TXN-2026-0119-001                              │
├─────────────────────────────────────────────────────────────────────┤
│ Client: John Smith                                                  │
│ Bundle: Ultimate Strength Package                                   │
│ Date: January 19, 2026 at 2:34 PM                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Products                                                            │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Item                    │ Price   │ Commission │ Your Income  │   │
│ │ Protein Powder (2kg)    │ £49.99  │ 14% + 5%   │ £9.50        │   │
│ │ Resistance Bands Set    │ £24.99  │ 14%        │ £3.50        │   │
│ │ Pre-Workout Formula     │ £34.99  │ 14% + 10%  │ £8.40        │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Services                                                            │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Service                 │ Qty │ Unit Price │ Your Income      │   │
│ │ Personal Training (1hr) │ 4   │ £50.00     │ £200.00          │   │
│ │ Nutrition Check-in      │ 2   │ £25.00     │ £50.00           │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Summary                                                             │
│ ─────────────────────────────────────────────────────────────────   │
│ Gross Amount:        £284.96                                        │
│ Product Commission:  £21.40                                         │
│ Service Revenue:     £250.00                                        │
│ Total Income:        £271.40                                        │
│ Points Earned:       285 (base) + 250 (new client) = 535            │
└─────────────────────────────────────────────────────────────────────┘
```

### Performance Analytics

#### Best Selling Bundles

Ranked list of trainer's top-performing bundles:

| Rank | Bundle Name | Units Sold | Revenue | Your Income |
|------|-------------|------------|---------|-------------|
| 1 | Ultimate Strength Package | 24 | £6,839.76 | £2,456.30 |
| 2 | Weight Loss Starter Kit | 18 | £3,599.82 | £1,295.94 |
| 3 | Longevity Essentials | 12 | £2,879.88 | £1,036.76 |

#### Best Selling Products

Top products across all bundles:

| Rank | Product | Units Sold | Commission Earned |
|------|---------|------------|-------------------|
| 1 | Protein Powder (2kg) | 42 | £399.00 |
| 2 | Pre-Workout Formula | 38 | £319.20 |
| 3 | BCAA Supplements | 31 | £186.00 |

#### Best Selling Services

Most popular service offerings:

| Rank | Service | Sessions Sold | Revenue |
|------|---------|---------------|---------|
| 1 | Personal Training (1hr) | 156 | £7,800.00 |
| 2 | Nutrition Check-in | 89 | £2,225.00 |
| 3 | Program Review | 45 | £1,125.00 |

### Client Metrics

| Metric | Value | Trend |
|--------|-------|-------|
| **Total Clients** | Active client count | vs. last month |
| **New Clients** | Clients acquired this period | vs. last month |
| **Client Retention Rate** | % of clients with repeat purchases | vs. last month |
| **Average Bundle Price** | Mean transaction value per client | vs. last month |

---

## Awards & Recognition

### Monthly Awards

| Award | Criteria | Prize |
|-------|----------|-------|
| **Top Seller** | Highest revenue in month | 2,000 bonus points + Featured placement |
| **Rising Star** | Highest month-over-month growth | 1,000 bonus points |
| **Client Champion** | Best retention rate (min. 10 clients) | 1,000 bonus points |
| **Bundle Innovator** | Most creative bundle (manager selected) | 500 bonus points |

### Annual Benefits by Tier

#### Platinum Benefits
- Dedicated account manager
- Invitation to annual trainer summit (travel included)
- Early access to new product lines
- Custom bundle templates
- Priority customer support (< 2 hour response)
- Quarterly strategy sessions with management
- Featured in marketing materials

#### Gold Benefits
- Featured trainer badge on profile
- Early access to new features
- Monthly performance insights report
- Priority customer support (< 4 hour response)
- Quarterly newsletter feature opportunity

#### Silver Benefits
- Monthly insights report
- Priority customer support (< 8 hour response)
- Access to advanced training modules
- Eligibility for monthly awards

---

## Implementation Roadmap

### Phase 1: Foundation (Current Sprint)
- [ ] Create `trainer_points` database table
- [ ] Create `trainer_status` database table
- [ ] Create `point_transactions` table for audit trail
- [ ] Add points calculation to order processing
- [ ] Build status tier calculation logic

### Phase 2: Dashboard Enhancement
- [ ] Add status badge component to trainer dashboard
- [ ] Build points progress bar with tier visualization
- [ ] Create transaction detail modal with full breakdown
- [ ] Add downloadable PDF statement generation
- [ ] Build best sellers analytics components

### Phase 3: Advanced Features
- [ ] Implement vending machine code system
- [ ] Build bonus points automation (new client, retention, etc.)
- [ ] Create monthly awards calculation and notification
- [ ] Add tier benefit enforcement (commission rate adjustments)
- [ ] Build referral tracking system

### Phase 4: Engagement
- [ ] Create trainer leaderboard (opt-in)
- [ ] Build achievement badges system
- [ ] Implement push notifications for point milestones
- [ ] Create annual summary report generation

---

## Database Schema

### trainer_points

```sql
CREATE TABLE trainer_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id INT NOT NULL,
  current_points INT DEFAULT 0,
  lifetime_points INT DEFAULT 0,
  current_status ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
  status_expires_at TIMESTAMP,
  points_this_month INT DEFAULT 0,
  points_this_year INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

### point_transactions

```sql
CREATE TABLE point_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id INT NOT NULL,
  order_id INT,
  points INT NOT NULL,
  type ENUM('sale', 'bonus', 'referral', 'award', 'adjustment') NOT NULL,
  description VARCHAR(255),
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### trainer_awards

```sql
CREATE TABLE trainer_awards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id INT NOT NULL,
  award_type VARCHAR(100) NOT NULL,
  award_period VARCHAR(20), -- e.g., '2026-01' for monthly
  points_awarded INT DEFAULT 0,
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `trainer.points.summary` | GET | Current points, status, and tier progress |
| `trainer.points.history` | GET | Point transaction history with pagination |
| `trainer.points.breakdown` | GET | Detailed breakdown by category |
| `trainer.transactions.list` | GET | Sales transactions with filtering |
| `trainer.transactions.detail` | GET | Single transaction with full breakdown |
| `trainer.transactions.statement` | GET | Generate PDF statement |
| `trainer.analytics.bestSellers` | GET | Top bundles, products, services |
| `trainer.analytics.clients` | GET | Client metrics and trends |
| `trainer.awards.list` | GET | Awards earned by trainer |
| `admin.points.adjust` | POST | Manual point adjustment (admin only) |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trainer engagement with dashboard | 80% weekly active | Analytics tracking |
| Point redemption awareness | 90% know their status | Survey |
| Tier advancement rate | 30% advance within 6 months | Database query |
| Vending machine code usage | 25% of vending sales | Transaction tracking |
| Trainer satisfaction | 4.5/5 rating | Quarterly survey |

---

## Future Enhancements

1. **Points Marketplace**: Allow trainers to redeem points for merchandise, training, or cash bonuses
2. **Team Competitions**: Gym-level competitions between trainer teams
3. **Client Rewards Integration**: Shared points ecosystem with client loyalty program
4. **Gamification**: Achievement badges, streaks, and challenges
5. **Mobile Push Notifications**: Real-time point earning alerts
6. **Social Sharing**: Share achievements and milestones on social media

---

## Appendix: Commission Calculation Example

**Scenario**: Gold-tier trainer sells a bundle containing:
- Protein Powder (£49.99) with 5% SPF
- Resistance Bands (£24.99) no SPF
- 4x Personal Training sessions (£50.00 each)

**Calculation**:

| Item | Price | Base Rate | Tier Bonus | SPF | Total Rate | Income |
|------|-------|-----------|------------|-----|------------|--------|
| Protein Powder | £49.99 | 10% | +4% | +5% | 19% | £9.50 |
| Resistance Bands | £24.99 | 10% | +4% | 0% | 14% | £3.50 |
| Training (×4) | £200.00 | 100% | - | - | 100% | £200.00 |

**Total Income**: £213.00  
**Points Earned**: 275 (based on £274.98 gross)

