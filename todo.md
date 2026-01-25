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
- [x] OAuth login (Google/Apple)
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
- [x] Deliveries management with reschedule approval/rejection
- [x] Settings screen (username, bio, specialties, social links)
- [ ] Media gallery management (photos/videos)
- [x] Points/Status system with tiers (Bronze/Silver/Gold/Platinum)
- [x] Ad partnerships management
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

## New Features to Implement

### Live Backend Connection
- [x] Connect catalog screen to real API
- [x] Connect trainer dashboard to real API
- [ ] Connect products screen to real API
- [ ] Connect trainer directory to real API
- [ ] Connect client dashboard to real API
- [ ] Connect manager dashboard to real API
- [ ] Connect all CRUD operations to real API

### OAuth Login
- [x] Google OAuth login
- [x] Apple OAuth login
- [x] OAuth callback handling

### Push Notifications
- [x] Request notification permissions
- [x] Register for push notifications
- [x] Delivery status notifications
- [x] Session reminder notifications
- [x] New message notifications

### Missing Features from Original Locoman
- [x] Trainer deliveries management screen (mark ready, mark delivered, reschedule approval)
- [x] Ad partnerships screen (submit business, create partnership, earnings)
- [x] Manager bundle approvals screen
- [x] Manager ad approvals screen (combined with bundle approvals)
- [x] Manager deliveries screen
- [x] Manager products screen
- [ ] Manager settings screen
- [ ] Manager SPF management screen
- [ ] Manager tag management screen
- [ ] Trainer image analytics screen
- [ ] Trainer messages screen (separate from general messaging)
- [ ] Business signup page
- [ ] Trainer landing page
- [ ] Impersonation banner component
- [ ] Pull-to-refresh on all list screens
- [ ] Swipeable list items for quick actions
- [ ] Image cropper/upload component
- [ ] Media gallery management
- [ ] Bulk invite dialog

## New Features - Follow-up Implementation

### Pull-to-Refresh
- [x] Add RefreshControl to catalog/home screen
- [x] Add RefreshControl to products screen
- [x] Add RefreshControl to trainer directory screen
- [ ] Add RefreshControl to trainer dashboard
- [ ] Add RefreshControl to trainer clients screen
- [ ] Add RefreshControl to trainer orders screen
- [ ] Add RefreshControl to trainer deliveries screen
- [ ] Add RefreshControl to client dashboard
- [ ] Add RefreshControl to client orders screen
- [ ] Add RefreshControl to client deliveries screen
- [ ] Add RefreshControl to manager screens

### Loading Skeletons
- [x] Create reusable skeleton components
- [x] Add skeleton to bundle cards
- [x] Add skeleton to product cards
- [x] Add skeleton to trainer cards
- [x] Add skeleton to order items
- [x] Add skeleton to delivery items
- [x] Add skeleton to dashboard stats

### Media Gallery
- [x] Create image picker component using expo-image-picker
- [x] Create media gallery component for displaying images
- [ ] Add image upload to trainer profile
- [x] Add image upload to bundle editor
- [x] Implement image cropping/resizing (via allowsEditing)

### Bundle Image Generation
- [x] Create AI image generation service using server LLM
- [x] Add "Generate Image" button to bundle editor
- [x] Generate bundle cover images based on bundle description
- [x] Save generated images to storage

### Shopify Integration
- [x] Create Shopify API client
- [x] Implement product sync from Shopify
- [x] Implement inventory sync
- [x] Add Shopify product import to manager products screen
- [ ] Handle Shopify webhooks for real-time updates (requires external endpoint)

## New Features - Follow-up Implementation II

### Haptic Feedback
- [x] Add haptic feedback to all button presses (HapticButton component)
- [x] Add haptic feedback to tab navigation (HapticTab component)
- [x] Add haptic feedback to swipe actions (via use-haptics hook)
- [x] Add haptic feedback to pull-to-refresh (via RefreshableScrollView)
- [x] Add haptic feedback to form submissions (login/register screens)
- [x] Add haptic feedback to toggle switches (via use-haptics hook)
- [x] Add haptic feedback to cart actions (add/remove) - already in cart-context

### Offline Mode
- [x] Create AsyncStorage caching service (offline-cache.ts)
- [x] Cache bundles for offline browsing
- [x] Cache products for offline browsing
- [x] Cache trainer directory for offline browsing
- [x] Show offline indicator when not connected (OfflineIndicator component)
- [x] Sync data when connection restored
- [x] Handle stale cache gracefully Bundle Editor Improvements
- [x] Review original locoman BundleEditor implementation
- [x] Ensure all fields match original (title, description, goals, products, services)
- [x] Implement product selection modal with search/filter
- [x] Implement service configuration (sessions, check-ins, deliveries)
- [x] Add pricing auto-calculation from products + services
- [x] Add bundle status management (draft/pending_review/published/rejected)
- [x] Add submit for review workflow
