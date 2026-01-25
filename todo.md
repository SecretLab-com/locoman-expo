# Project TODO

## Setup
- [x] Generate app logo and configure branding
- [x] Update theme colors to match design
- [x] tRPC client configuration
- [x] Auth token handling in API calls
- [x] Cart context with AsyncStorage persistence

## Authentication
- [x] Login screen with email/password
- [x] Register screen with validation
- [x] Auth context and token storage
- [x] Protected route handling
- [ ] OAuth login (Google/Apple)
- [x] Role-based navigation (shopper/client/trainer/manager)
- [x] Impersonation support for coordinator role

## Navigation
- [x] Bottom tab navigation setup
- [x] Role-based tab configuration
- [x] Icon mappings for tabs

## Shopper Features
- [x] Catalog screen with bundle grid
- [x] Bundle detail screen
- [x] Cart screen with item management
- [x] Add to cart functionality
- [x] Profile screen
- [x] Logout functionality
- [x] Products catalog (Shopify integration)
- [x] Product detail sheet with add to cart
- [x] Trainer directory with search and filters
- [x] Trainer public profile view (/trainer/:id)
- [x] Request to join trainer
- [ ] Join request status tracking

## Trainer Features
- [x] Trainer dashboard with stats
- [x] Bundles management screen
- [x] Clients list screen
- [x] Earnings screen
- [x] Bundle creation flow (BundleEditor)
- [x] Bundle editing with product selection
- [x] Service configuration (sessions, check-ins)
- [x] Client detail view
- [x] Session usage tracking (trainer marks used, show remaining to both)
- [x] Calendar with session scheduling
- [x] Orders management screen with tabs (pending/processing/completed)
- [ ] Deliveries management with reschedule approval/rejection
- [x] Settings screen (username, bio, specialties, social links)
- [ ] Media gallery management (photos/videos)
- [x] Points/Status system with tiers (Bronze/Silver/Gold/Platinum)
- [ ] Ad partnerships management
- [x] Invite client to bundle (generate invitation link)
- [ ] Bulk invite dialog
- [ ] Join requests management (approve/reject)

## Client Features
- [x] Client home dashboard
- [x] Orders screen
- [x] Deliveries screen
- [x] Sessions remaining display (X of Y sessions used)
- [x] Delivery tracking
- [x] Confirm delivery receipt
- [x] Report delivery issue
- [x] Subscriptions management (pause/resume/cancel)
- [x] Spending history with charts
- [ ] Upcoming session view
- [ ] Request delivery reschedule

## Manager/Admin Features
- [x] Manager dashboard with stats cards
- [x] Low inventory alerts with dismiss/alert trainer actions
- [x] Users management (list, search, filter by role)
- [x] Trainers management
- [x] Bundle templates management
- [x] Analytics dashboard
- [x] Invitations management with analytics
- [x] Send low inventory alert to trainer

## Coordinator Features
- [x] User impersonation page
- [x] Quick role simulation (test as any role)
- [x] Impersonation shortcuts (starred users)
- [x] Impersonation logs
- [x] Search users by role

## Checkout & Orders
- [x] Cart item quantity management
- [x] Fulfillment option per item
- [x] Subtotal calculation
- [x] Checkout flow (ready for Shopify integration)
- [x] Order confirmation screen

## Deliveries
- [x] Delivery management (mark ready, mark delivered)
- [ ] Delivery method selection (in_person, locker, front_desk, shipped)
- [ ] Tracking number for shipped items
- [ ] Reschedule request/approval flow
- [ ] Delivery stats (pending, ready, delivered, confirmed, disputed)

## Messaging
- [x] Conversations list
- [x] Message thread view
- [x] Send text messages
- [x] Unread message indicators
- [x] Message trainer

## Invitations
- [x] Invitation landing page (/invite/:token)
- [x] Accept/decline invitation
- [x] Invitation with bundle preview (products, services, goals)
- [x] Share invitation link
- [x] Personal message from trainer

## Public Pages
- [x] Public trainer profile (/trainer/:id) with bundles
- [ ] Public user profile (/u/:userId)
- [x] Trainer directory page with search and filters

## Settings & Profile
- [ ] Theme toggle (dark/light mode)
- [ ] Username with availability check
- [ ] Bio editing
- [ ] Specialties selection (up to 4)
- [ ] Social links (Instagram, Twitter, LinkedIn, Website)
- [ ] Avatar/photo upload

## Pull-to-Refresh
- [ ] Add pull-to-refresh to all list screens

## Additional UI Components
- [ ] Swipeable list items for quick actions
- [ ] Progress bars for session usage
- [ ] Badge system for status tiers
- [ ] Loading skeletons for all screens
- [ ] Haptic feedback on actions
