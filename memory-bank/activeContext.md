# Active Context

## Current Focus
- **Supabase migration complete**: All 20 tables migrated with RLS policies and RPC functions
- **Supabase Auth implemented**: Replaced custom OAuth with Supabase Auth (Google OAuth provider)
- **Real API integration**: 20+ mock screens converted to real tRPC API calls
- **WebSocket authentication**: Fixed to use Supabase JWT tokens
- **Performance optimization**: N+1 queries eliminated via RPC functions
- **Error handling**: Added comprehensive error handling to all DB queries
- **Legacy cleanup**: Old SDK and ORM code removed

## Recent Changes
- **Products IA refactor**: Storefront menu now has `Bundles`, `Categories`, and `Products` as separate modes
  - `Bundles` shows large trainer bundle tiles (client-scoped bundles for active trainer relationships; all bundles for non-client roles)
  - `Categories` shows side-scrolling large Shopify collection cards with per-card `See All`
  - `See All` deep-links into `Products` with that collection preselected as the active filter
  - `Products` shows only individual catalog products with search + horizontal category filters including `All Products`
- **Categories now driven by Shopify Shop-channel collections**: Product Categories no longer use static hardcoded category list
  - Added Shopify collection publication/channel sync via GraphQL (with REST fallback)
  - Added `channels` + `shopEnabled` metadata and filtered category source to Shop-enabled collections only
  - Category cards now render dynamically from synced Shopify collections data
- **Shopify collection-backed category cards**: Product Categories view now renders horizontal background-image cards from Shopify Collections
  - Added `catalog.collections` API route backed by new `shopify.fetchCollections()` (custom + smart collections)
  - Replaced category chip row with storefront-style image cards and overlay labels/counts
- **Invite-aware registration UX**: Register screen now preloads invite context and enforces invite email
  - Added `auth.inviteRegistrationContext` public endpoint for token lookup across user/trainer invite types
  - `/register` now pre-fills name/email from invite token and locks email editing when invite email exists
- **Pending invite revoke reliability fix**: Revoke confirm flow now uses `window.confirm` on web and `Alert.alert` on native
  - Fixes web path where Alert button callbacks can fail to execute, causing revoke to appear non-functional
- **iOS manager/coordinator invite delivery fix**: `admin.createUserInvitation` now sends Resend email as part of mutation
  - Previous behavior created invitation records without dispatching email
  - Mutation now fails if email send fails and auto-revokes the just-created invite to avoid false "sent" state
- **Pending invite resend flow**: Added `resendUserInvitation` backend mutation and wired "Resend" actions in manager/coordinator pending invite lists
  - Resend now rotates invite token, extends expiry by 7 days, and re-sends invite email via Resend
  - Invite failures in resend flow are surfaced with user-friendly errors and a Server message notification
- **Database**: Complete migration to Supabase PostgreSQL
  - All 20 tables created with proper enum types, indexes, and foreign keys
  - RLS policies enabled on all tables
  - RPC functions created for atomic operations (eliminates N+1 queries)
  - `updated_at` triggers on all mutable tables
- **Authentication**: Migrated to Supabase Auth
  - Google OAuth via Supabase provider
  - Test accounts with password authentication
  - JWT tokens from Supabase used throughout app
- **API Layer**: Converted mock screens to real tRPC endpoints
  - 20+ screens now use real API calls instead of mock data
  - Type-safe tRPC routers with proper error handling
  - All DB queries wrapped with error handling
- **WebSocket**: Updated to verify Supabase JWT tokens
  - Custom WebSocket server authenticates using Supabase JWT
  - Real-time messaging works with Supabase auth
- **Database Layer**: `server/db.ts` using Supabase JS client
  - Snake_case ↔ camelCase conversion layer
  - All IDs are UUID strings
  - Service role client for server-side operations
- **Frontend**: Supabase client integration
  - `lib/supabase-client.ts` for frontend auth operations
  - `lib/supabase.ts` for server-side operations
- **Auth Utilities**: `server/_core/auth-utils.ts` for shared auth helpers
- **Removed**: Legacy SDK (`server/_core/sdk.ts`) and legacy SQL dependencies

## Next Steps / Remaining TODOs
- **Join requests endpoint**: Needs implementation
- **Partnerships**: Still using mock data, needs real API
- **Checkout flow**: Needs completion
- **Revenue analytics**: Some mock data remains, needs real calculations
- **Testing**: Full end-to-end testing of all flows
- **Deployment**: Update Cloud Run with Supabase environment variables

## Decisions
- **Supabase as single source**: Database + Auth provider (no separate auth system)
- **Service role key**: Used for all server-side DB operations (bypasses RLS)
- **RLS policies**: Created for potential direct client access in future
- **Snake_case in DB**: Postgres uses snake_case, app code uses camelCase with conversion layer
- **RPC functions**: Used for complex queries to avoid N+1 problems
- **Type safety**: tRPC provides end-to-end type safety from DB to frontend
