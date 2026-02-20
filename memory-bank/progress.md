# Progress

## What Works
- **3-mode storefront browsing**: Products screen now cleanly separates `Bundles`, `Categories`, and `Products`
  - Bundles render as large tiles and route to bundle details
  - Categories render as horizontal large Shopify collection cards with `See All`
  - `See All` opens Products mode with that collection filter selected
  - Products mode renders only individual products with search + `All Products`/collection filters
- **Storefront categories UI**: Category browsing now uses Shopify Collection artwork in horizontal card carousel
  - Cards are image-backed with overlay label/count and selection state
- **Dynamic category source**: Categories are now fetched from Shopify collection sync data (Shop-enabled channel only), not static code lists
- **User invitation management**: Pending invite lists now support both revoke and resend actions
  - Resend rotates token, refreshes expiry window, and sends a new invite email
  - Revoke action now works consistently on web (browser confirm) and native (Alert modal)
- **Invite-based registration**: Register now pre-fills invited name/email and prevents invite-email edits
  - Invite token context resolves from backend and supports both manager/coordinator and trainer invite token types
- **Manager/coordinator invite creation**: Invite creation now dispatches email through Resend (not DB-only)
  - Create flow is fail-closed: if mail provider send fails, API returns error and the created invite is auto-revoked
- **Database Migration**: Complete migration to Supabase PostgreSQL
  - All 20 tables created and working
  - RLS policies configured
  - RPC functions for complex queries
- **Authentication**: Supabase Auth fully integrated
  - Google OAuth via Supabase provider
  - Password-based test accounts
  - JWT token authentication throughout app
- **API Integration**: 20+ screens using real tRPC API calls
  - Client screens (deliveries, orders, spending, subscriptions)
  - Trainer screens (calendar, clients, deliveries, earnings, orders, bundles)
  - Manager screens (analytics, approvals, deliveries, invitations, templates, trainers, users)
  - Coordinator screens (logs, users)
  - Shared screens (messages, products, trainers, browse, bundle editor, checkout, profile, settings)
- **WebSocket**: Real-time messaging with Supabase JWT authentication
- **Error Handling**: Comprehensive error handling on all DB queries
- **Performance**: N+1 queries eliminated via RPC functions
- **Type Safety**: End-to-end type safety with tRPC
- **Navigation**: Expo Router working across all user roles
- **Styling**: NativeWind styling applied throughout

## What's Left
- **Join Requests Endpoint**: Needs implementation for trainer join requests
- **Partnerships**: Still using mock data, needs real API integration
- **Checkout Flow**: Needs completion and integration with payment processing
- **Revenue Analytics**: Some mock data remains, needs real calculations from database
- **Testing**: Full end-to-end testing of all user flows
- **Deployment**: Update Cloud Run deployment with Supabase environment variables
- **Documentation**: Update API documentation and user guides

## Current Status
- **Phase 1 (Database Migration)**: ✅ Complete
- **Phase 2 (Supabase Auth)**: ✅ Complete
- **Phase 3 (API Integration)**: ✅ 20+ screens converted, few remaining
- **Phase 4 (WebSocket Auth)**: ✅ Complete
- **Phase 5 (Performance Optimization)**: ✅ N+1 queries fixed
- **Phase 6 (Error Handling)**: ✅ Complete
- **Phase 7 (Legacy Cleanup)**: ✅ Old SDK removed

## Known Issues
- **Join Requests**: Endpoint not yet implemented
- **Partnerships**: Mock data still in use
- **Checkout**: Flow incomplete
- **Revenue Analytics**: Some calculations still use mock data
