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

## Login Button and Test User
- [x] Add login button to landing/home page for unauthenticated users
- [x] Configure test user credentials (testuser@secretlab.com / supertest)
- [x] Verify login flow works with test credentials

## OAuth and Trainer Account Fixes
- [x] Fix OAuth routing issue - /api/auth/google showing unmatched route
- [x] Fix popup window blocked error on mobile OAuth
- [x] Add dedicated trainer test account (trainer@secretlab.com / supertest)
- [x] Add client test account (client@secretlab.com / supertest)
- [x] Add manager test account (manager@secretlab.com / supertest)
- [x] Ensure trainer role is assigned to trainer test account
- [x] Verify trainer can access bundle creation screen

## Login Enhancements
- [x] Add Remember Me option with persistent token storage
- [x] Add password visibility toggle (eye icon)
- [x] Add test account quick-fill buttons for easy testing

## User Journey Validation
- [x] Validate trainer journey: login → dashboard → bundles → create bundle → submit for review
- [x] Validate client journey: login → dashboard → subscriptions → deliveries
- [x] Validate manager journey: login → dashboard → approvals → user management
- [x] Validate shopper journey: browse catalog → add to cart → checkout
- [x] Add role-based dashboard navigation to profile screen
- [x] Add role badge display on profile
- [x] Add trainer quick actions on profile
- [x] Add manager quick actions on profile

## Superadmin Impersonation Feature
- [x] Create impersonation API endpoint on server
- [x] Add impersonation UI to coordinator dashboard
- [x] Show user list with impersonate buttons (with search, filter, and star favorites)
- [x] Add impersonation banner when impersonating (global banner in root layout)
- [x] Add "End Impersonation" button to return to coordinator

## Push Notifications System
- [x] Set up expo-notifications configuration (already configured)
- [x] Create notification context/provider (already exists)
- [x] Add notification handlers for bundle approvals
- [x] Add notification handlers for new orders
- [x] Add notification handlers for delivery updates
- [x] Add navigation routing for all notification types

## Dark Mode Toggle
- [x] Create settings screen (trainer settings already exists)
- [x] Add theme toggle switch (3-way: System/Light/Dark)
- [x] Persist theme preference (AsyncStorage)
- [x] Support system, light, and dark modes
- [x] Add theme toggle to profile screen preferences
- [x] Add theme toggle to trainer settings screenr to use persisted preference

## Login Button Fix
- [x] Add login button to landing page header for unauthenticated users
- [x] Fix login button navigation and role-based redirect after login
- [x] Add coordinator test account (coordinator@secretlab.com / supertest)
- [x] Add coordinator quick-fill button to login screen
- [x] Document impersonation feature usage


## Product Delivery Customer Journey Audit
- [x] Step 1: Trainer adds product to bundle - bundle editor supports products ✓
- [x] Step 2: Bundle approval and publishing - approval workflow exists ✓
- [x] Step 3: Trainer sends bundle invitation - invitation system exists ✓
- [x] Step 4: Customer approves and pays - checkout flow exists ✓
- [ ] Step 5: Product delivery scheduled - **MISSING**: auto-creation of delivery records
- [x] Step 6: Trainer gets 1-day reminder - notification system exists ✓
- [x] Step 7: Trainer hands product to customer - delivery methods supported ✓
- [x] Step 8: Trainer marks as delivered - markDelivered mutation exists ✓
- [x] Step 9: Customer sees confirmation - client deliveries page exists ✓
- [x] Step 10: Customer confirms or contests - confirm/report mutations exist ✓

### Critical Gaps to Fix
- [x] Auto-create productDeliveries records when order is placed (deliveries.createForOrder)
- [x] Implement client myDeliveries API endpoint (now queries by clientId)
- [x] Add reschedule API endpoints (requestReschedule/approveReschedule/rejectReschedule)
- [x] Connect trainer deliveries screen to real API (removed mock data)
- [x] Connect client deliveries screen to real API (removed mock data)

### Medium Priority Gaps
- [ ] Add reschedule database fields (rescheduleRequestedAt, rescheduleRequestedDate)
- [ ] Add reschedule notification functions
- [ ] Manager escalation workflow for disputes

### Low Priority Gaps
- [ ] Delivery analytics/metrics
- [ ] Batch delivery actions


## Bundle-to-Delivery Journey Implementation
### Phase 1: Bundle Creation
- [x] Add bundle templates for quick start (bundle editor exists)
- [x] Bundle editor with tabs (Details, Services, Products, Goals)
- [x] Product selection from Shopify catalog
- [x] Auto-price calculation
- [x] Save as draft functionality
- [x] Submit for review workflow

### Phase 2: Bundle Review Workflow
- [x] Manager approvals screen exists
- [x] Add review comments/feedback system to bundle detail (reviewComments field added)
- [x] Add "Request Changes" action with comment input (requestChanges endpoint)
- [x] Add "changes_requested" status support (schema updated)
- [x] Show manager comments in trainer's bundle editor (yellow banner)
- [x] Add resubmission workflow after addressing feedback
- [x] Add notification on bundle status changes

### Phase 3: Customer Invitation & Purchase
- [x] Invite client screen exists
- [x] Invitation landing page with bundle preview
- [x] Accept invitation flow
- [x] Add mock payment flow for testing (payment modal added)
- [x] Auto-create order on acceptance
- [x] Auto-create delivery records when order is placed (deliveries.createForOrder)
- [x] Notification to trainer on acceptance

### Phase 4: Product Delivery
- [x] Trainer deliveries screen with real API
- [x] Mark ready / Mark delivered actions
- [x] Client deliveries screen with real API
- [x] Confirm receipt action
- [x] Report issue action (reportIssue mutation)
- [x] Disputed status handling
- [x] Messaging integration for issue resolution (message trainer button)
- [ ] Add ability to create additional delivery for missing items

### Phase 5: Session Tracking
- [x] Session scheduling (Calendar)
- [x] Mark session complete
- [x] Session usage tracking (X of Y used) display (client-detail screen)
- [x] Client detail with subscription status showing remaining sessions
- [x] Session history view (past sessions tab)


## Bug Fixes
- [x] Fix trainers screen specialty filter pills displaying as tall vertical rectangles instead of horizontal pills
- [x] Fix product selection modal header overlapping with notch/Dynamic Island
- [x] Display actual product images from Shopify sync instead of placeholders
- [x] Add category filter to product selection modal

## New Features
- [x] Set up Shopify environment variables for real store connection
- [x] Add product quantity selector to bundle product selection
- [x] Implement barcode scanner for SKU lookup

- [x] Fix product selection modal filter bar hidden/cut off behind search bar


## Bug Fixes - Manager Trainers Screen
- [x] Fix top content overlapping with impersonation banner
- [x] Fix status filter pills displaying as tall vertical rectangles instead of horizontal pills

## Sprint 2 Implementation
- [x] Create TemplateEditor screen for managers
- [x] Implement bulk invite feature with CSV upload and manual entry


## Follow-up Features - Sprint 3
- [x] Connect bulk invite modal to clients.bulkInvite API
- [x] Add template usage tracking when creating bundles from templates
- [x] Create join requests management screen for trainers


## Navigation Simplification
- [x] Create Mermaid chart of current navigation structure
- [x] Move profile/settings to FAB in top right corner
- [x] Fix bottom nav switching issue with Discover More (created /browse screen)
- [x] Hide profile tab from bottom nav (now accessed via FAB)


## Bug Fixes - Manager Users Screen
- [x] Fix role filter pills displaying as tall vertical rectangles instead of horizontal pills


## Manager Users Screen Enhancements
- [x] Add user detail modal with full profile view
- [x] Add role change action in user detail modal
- [x] Add deactivate/activate user action
- [x] Implement pagination/infinite scroll for user list
- [x] Add CSV export functionality for user lists


## Manager Users - Real API & Advanced Features
- [x] Create tRPC users.list endpoint with pagination support
- [x] Add role filter to users.list endpoint
- [x] Add status filter (active/inactive) to users.list endpoint
- [x] Add date range filter (joined date) to users.list endpoint
- [x] Create tRPC users.updateRole endpoint
- [x] Create tRPC users.updateStatus endpoint
- [x] Create tRPC users.bulkUpdateRole endpoint
- [x] Create tRPC users.bulkUpdateStatus endpoint
- [x] Update Manager Users screen to use real tRPC API
- [x] Add status filter UI (Active/Inactive toggle)
- [x] Add date range filter UI for joined date
- [x] Add bulk selection mode with checkboxes
- [x] Add bulk action bar (change role, activate/deactivate)
- [x] Add select all / deselect all functionality


## Manager Users - Advanced Features
- [x] Create user impersonation feature (become any user for testing)
- [x] Add "Impersonate" button in user detail modal
- [x] Store original manager session for returning from impersonation
- [x] Add impersonation banner showing current impersonated user
- [x] Add "Return to Manager" button to exit impersonation
- [x] Create activity_log database table for user actions
- [x] Add API endpoint to log user actions (role change, status update, etc.)
- [x] Add API endpoint to fetch activity log for a user
- [x] Display activity log in user detail modal
- [x] Create user invite system with email input
- [x] Add role selection for invited users
- [x] Create pending_invites database table
- [x] Add API endpoint to create and send invites
- [x] Add invited users list in Manager Users screen


## Journey Audit - End-to-End Testing
- [x] Audit Journey 1: Shopper Discovery & Purchase (catalog works, cart needs real checkout)
- [x] Audit Journey 2: Trainer Bundle Creation & Approval (buttons work, browser automation limitation)
- [ ] Audit Journey 3: Client Invitation & Onboarding
- [ ] Audit Journey 4: Product Delivery Flow
- [ ] Audit Journey 5: Session Tracking
- [ ] Audit Journey 6: Manager Approval Workflow
- [ ] Audit Journey 7: Coordinator Impersonation
- [ ] Audit Journey 8: Messaging

### Journey Findings
- Bundle editor buttons fixed with native HTML buttons for web
- Alerts are auto-dismissed by browser automation (expected)
- Buttons work correctly for real users
- Catalog displays real bundles from database
- Cart functionality works with AsyncStorage persistence


## Product Selection Modal Fixes
- [x] Remove "Bundle" from filter options (bundles cannot contain other bundles)
- [x] Add product detail screen when clicking on image or product name
- [x] Only toggle selection when clicking on checkbox area (right side)
- [x] Separate click zones: left side for detail view, right side for selection


## Product Detail Modal Enhancements
- [x] Add quantity selector with +/- buttons in product detail modal
- [x] Show current quantity if product already in bundle
- [x] Update "Add to Bundle" button to show quantity
- [x] Add barcode scan button in product detail modal header
- [x] Navigate to matching product when barcode scanned
- [x] Show product recommendations based on same type
- [x] Show product recommendations based on same vendor
- [x] Make recommendations clickable to view their details


## Bug Fix - ProfileFAB Crash
- [x] Fix ProfileFAB crash when user.role is undefined (Cannot read property 'charAt' of undefined)


## Bug Fix - Login Failure in Manus Preview
- [x] Investigate login state not updating after successful login
- [x] Check cookie/session persistence in Manus preview environment
- [x] Fix authentication state synchronization (fixed cookie domain extraction for Manus preview)


## Bug Fix - Expo App Not Loading SQL Data
- [x] Investigate database connection from Expo app
- [x] Check API endpoints for data fetching (found auth issue - token not stored for native)
- [x] Fix session token storage for native apps (login now stores token in SecureStore)


## Bug Fix - No Products in Bundle Builder
- [x] Check if products exist in database (products table was empty)
- [x] Seeded 10 sample products (protein, pre-workout, recovery, vitamins, etc.)
- [x] Products now available in bundle builder


## Shopify Product Sync
- [x] Review old locoman repo for Shopify sync code (already exists in server/shopify.ts)
- [x] Implement Shopify API integration (already implemented)
- [x] Create product sync endpoint (shopify.sync mutation exists)
- [x] Sync products from remote Shopify store (250 products synced successfully)


## Bug Fix - Push Notification projectId Error
- [x] Fix "No projectId found" error in Expo Go
- [x] Make push notification registration graceful when not configured (skip registration if no EAS projectId)
