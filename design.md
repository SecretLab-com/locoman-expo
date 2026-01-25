# LocoMotivate Mobile App Design

## Overview

LocoMotivate is a fitness and wellness platform connecting trainers with clients. This document outlines the mobile-first design for iOS, Android, and Web deployment, following Apple Human Interface Guidelines.

## Screen List

The app has role-based navigation with different screens for each user type.

| Screen | Role | Description |
|--------|------|-------------|
| Login | Public | Email/password authentication |
| Register | Public | New user registration |
| Catalog | Shopper | Browse fitness bundles and products |
| Bundle Detail | Shopper | View bundle details, add to cart |
| Cart | Shopper | Review cart, proceed to checkout |
| Client Home | Client | Dashboard with subscriptions overview |
| Client Orders | Client | Order history and tracking |
| Client Deliveries | Client | Delivery tracking |
| Trainer Dashboard | Trainer | Stats, earnings, quick actions |
| Trainer Bundles | Trainer | Manage created bundles |
| Trainer Clients | Trainer | Client list and management |
| Trainer Earnings | Trainer | Earnings analytics |
| Profile | All | User profile and settings |

## Primary Content and Functionality

### Authentication Screens

The **Login Screen** presents a clean form with email and password fields, a prominent "Sign In" button, and a link to registration. The **Register Screen** includes name, email, and password fields with validation feedback.

### Shopper Flow

The **Catalog Screen** displays a grid of bundle cards with images, titles, trainer names, and prices. Each card is tappable to navigate to the detail view. A search bar at the top allows filtering. The **Bundle Detail Screen** shows a hero image, description, included products, trainer info, and an "Add to Cart" button. The **Cart Screen** lists cart items with quantity controls and a checkout summary.

### Client Dashboard

The **Client Home** shows active subscriptions as cards, recent orders, and upcoming deliveries. Quick action buttons provide access to orders and deliveries. The **Orders Screen** lists past orders with status badges. The **Deliveries Screen** tracks delivery status with progress indicators.

### Trainer Dashboard

The **Trainer Dashboard** displays key metrics (earnings, clients, bundles) in stat cards at the top. Below are quick action buttons for common tasks. The **Bundles Screen** lists trainer's bundles with edit/delete actions. The **Clients Screen** shows a list of clients with subscription status. The **Earnings Screen** presents earnings data with simple charts.

## Key User Flows

### Authentication Flow
1. User opens app → Login screen
2. User taps "Sign In" → Validates credentials → Navigates to role-based home
3. New user taps "Register" → Fills form → Creates account → Auto-login

### Shopping Flow
1. User browses Catalog → Taps bundle card
2. Bundle Detail opens → User reviews details
3. User taps "Add to Cart" → Item added with confirmation
4. User navigates to Cart → Reviews items → Proceeds to checkout

### Trainer Management Flow
1. Trainer opens Dashboard → Views stats
2. Taps "Bundles" tab → Views bundle list
3. Taps bundle → Edits details → Saves changes

## Color Choices

The app uses a fitness-focused color palette that conveys energy and trust.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | #10B981 (Emerald) | #34D399 | CTAs, active states, accent |
| Background | #FFFFFF | #0F172A | Screen backgrounds |
| Surface | #F1F5F9 | #1E293B | Cards, elevated elements |
| Foreground | #0F172A | #F8FAFC | Primary text |
| Muted | #64748B | #94A3B8 | Secondary text |
| Border | #E2E8F0 | #334155 | Dividers, borders |
| Success | #22C55E | #4ADE80 | Success states |
| Warning | #F59E0B | #FBBF24 | Warning states |
| Error | #EF4444 | #F87171 | Error states |

## Navigation Structure

The app uses **bottom tab navigation** as the primary navigation pattern, following iOS conventions.

### Tab Configuration by Role

**Shopper/Guest Tabs:**
- Home (Catalog)
- Cart
- Profile

**Client Tabs:**
- Home (Dashboard)
- Orders
- Deliveries
- Profile

**Trainer Tabs:**
- Dashboard
- Bundles
- Clients
- Earnings
- Profile

## iOS-Specific Considerations

The design follows Apple Human Interface Guidelines with large touch targets (44pt minimum), SF Symbols for icons, native-feeling animations, and proper safe area handling. The app supports both light and dark modes with automatic switching based on system preference.

## Typography

The app uses the system font (SF Pro on iOS) with the following scale:

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| Title | 28pt | Bold | Screen titles |
| Headline | 20pt | Semibold | Section headers |
| Body | 16pt | Regular | Primary content |
| Caption | 14pt | Regular | Secondary content |
| Small | 12pt | Regular | Timestamps, badges |
