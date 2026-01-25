# Project TODO

## Setup
- [x] Generate app logo and configure branding
- [x] Update theme colors to match design

## Authentication
- [x] Login screen with email/password
- [x] Register screen with validation
- [x] Auth context and token storage
- [x] Protected route handling
- [ ] OAuth login (Google/Apple)
- [x] Role-based navigation (shopper/client/trainer/manager)
- [x] Impersonation support for coordinator role
- [ ] Session token refresh
- [ ] Password reset flow

## Navigation
- [x] Bottom tab navigation setup
- [x] Role-based tab configuration
- [x] Icon mappings for tabs
- [ ] Dynamic tab switching based on user role

## Shopper Features
- [x] Catalog screen with bundle grid
- [x] Bundle detail screen
- [x] Cart screen with item management
- [x] Add to cart functionality
- [x] Profile screen
- [x] Logout functionality
- [ ] Connect catalog to real API (trpc.catalog.bundles)
- [ ] Connect bundle detail to real API (trpc.catalog.bundleDetail)
- [ ] Fulfillment option selection (home_ship, trainer_delivery, vending, cafeteria)
- [ ] Trainer directory browsing
- [ ] Trainer profile public view
- [ ] Goal-based filtering
- [ ] Search functionality

## Cart & Checkout
- [x] Cart context with AsyncStorage persistence
- [x] Cart item quantity management
- [x] Fulfillment option per item
- [x] Subtotal calculation
- [x] Checkout flow (ready for Shopify integration)
- [x] Order confirmation screen

## Trainer Features
- [x] Trainer dashboard with stats
- [x] Bundles management screen
- [x] Clients list screen
- [x] Earnings screen
- [ ] Connect dashboard to real API (trpc.bundles.list, trpc.clients.list)
- [x] Bundle creation flow (BundleEditor)
- [x] Bundle editing with product selection
- [ ] Bundle template selection
- [ ] Product search and filtering
- [x] Service configuration (sessions, check-ins)
- [ ] Bundle image upload/generation
- [ ] Submit bundle for review
- [ ] Bundle status tracking (draft, pending_review, published)
- [ ] Client invitation system
- [x] Client detail view
- [ ] Session scheduling
- [x] Session usage tracking (trainer marks used, show remaining to both)
- [ ] Subscription management with session counts
- [x] Delivery management (mark ready, mark delivered)
- [ ] Earnings analytics with charts
- [ ] Commission tracking
- [ ] Trainer profile editing (bio, specialties, social links)
- [ ] Gallery/media management
- [ ] Referral code generation

## Client Features
- [x] Client home dashboard
- [x] Orders screen
- [x] Deliveries screen
- [ ] Connect to real API (trpc.subscriptions, trpc.productDeliveries)
- [ ] Active subscription display
- [ ] Upcoming session view
- [x] Sessions remaining display (X of Y sessions used)
- [x] Delivery tracking
- [x] Confirm delivery receipt
- [x] Report delivery issue
- [ ] Request reschedule
- [x] Message trainer

## Manager Features (Admin)
- [ ] Manager dashboard
- [ ] User management (list, search, filter)
- [ ] Role assignment
- [ ] Trainer approval workflow
- [ ] Bundle review and approval
- [ ] Product sync from Shopify
- [ ] Order oversight
- [ ] Delivery oversight
- [ ] Analytics dashboard
- [ ] Template management
- [ ] Business referral management
- [ ] Ad partnership management

## Coordinator Features
- [ ] Impersonation system (become any user)
- [ ] Full admin access
- [ ] System configuration

## Messaging
- [x] Conversations list
- [x] Message thread view
- [x] Send text messages
- [ ] Real-time message updates
- [x] Unread message indicators

## Notifications
- [ ] Push notification setup
- [ ] Delivery status notifications
- [ ] Order status notifications
- [ ] Session reminder notifications
- [ ] Message notifications

## Calendar
- [ ] Calendar view
- [ ] Event creation
- [ ] Session scheduling integration
- [ ] Delivery scheduling

## Products
- [ ] Product list view
- [ ] Product detail view
- [ ] Inventory display
- [ ] Product categories

## API Integration
- [x] tRPC client configuration
- [x] Auth token handling in API calls
- [ ] Error handling and retry logic
- [ ] Offline support with caching

## UI Polish
- [ ] Loading states for all screens
- [ ] Error states and retry buttons
- [ ] Pull-to-refresh on lists
- [ ] Empty state illustrations
- [ ] Haptic feedback on actions
- [ ] Animations and transitions
