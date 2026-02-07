# Active Context

## Current Focus
- **Supabase migration complete**: All 20 tables migrated with RLS policies and RPC functions
- **Supabase Auth implemented**: Replaced custom OAuth with Supabase Auth (Google OAuth provider)
- **Real API integration**: 20+ mock screens converted to real tRPC API calls
- **WebSocket authentication**: Fixed to use Supabase JWT tokens
- **Performance optimization**: N+1 queries eliminated via RPC functions
- **Error handling**: Added comprehensive error handling to all DB queries
- **Legacy cleanup**: Old SDK and Drizzle ORM code removed

## Recent Changes
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
- **Removed**: Legacy SDK (`server/_core/sdk.ts`), Drizzle ORM, MySQL dependencies

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
