# Tech Context

## Stack
- **Frontend**: Expo / React Native with Expo Router
- **Backend**: Node.js with tRPC
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Design System**: `theme.config.js` + `design-system/` semantic tokens, recipes, and shared primitives
- **Language**: TypeScript
- **Package Manager**: PNPM

## Database
- **Provider**: Supabase PostgreSQL
- **ORM**: Direct Supabase JS client (no ORM layer)
- **Schema**: 20 tables with RLS policies
- **Functions**: RPC functions for complex queries
- **Naming**: Snake_case in database, camelCase in application code
- **IDs**: UUID strings throughout

## Authentication
- **Provider**: Supabase Auth
- **OAuth**: Google OAuth via Supabase provider
- **Test Accounts**: Password-based authentication for development
- **Tokens**: Supabase JWT tokens
- **Frontend Client**: `lib/supabase-client.ts` - Uses anon key
- **Server Client**: `lib/supabase.ts` - Uses service role key
- **Auth Utils**: `server/_core/auth-utils.ts` - Shared authentication helpers

## API Layer
- **Framework**: tRPC for type-safe APIs
- **Routers**: Defined in `server/routers.ts`
- **Context**: `server/_core/context.ts` - Provides authenticated user context
- **Error Handling**: Comprehensive error handling on all DB queries

## Database Layer
- **File**: `server/db.ts`
- **Client**: Supabase JS client with service role key
- **Conversion**: Automatic snake_case ↔ camelCase conversion
- **Functions**: 60+ database functions for CRUD operations
- **Types**: Exported from `server/db.ts`

## Real-time
- **WebSocket**: Custom WebSocket server (`server/_core/websocket.ts`)
- **Auth**: Verifies Supabase JWT tokens
- **Use Cases**: Real-time messaging, notifications

## Frontend Structure
- **Navigation**: Expo Router (file-based routing)
- **Screens**: Organized by user role (client, trainer, manager, coordinator)
- **Components**: Shared components in `components/`
- **Hooks**: Custom hooks in `hooks/`
- **Contexts**: React contexts for state management (e.g., cart-context.tsx)

## Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend)
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL exposed to client apps
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key exposed to client apps
- `EXPO_PUBLIC_API_BASE_URL` - API base URL used by client apps
- `PHYLLO_AUTH_BASIC` - Server-side basic auth used for direct Phyllo API pulls
- `PHYLLO_PERIODIC_SYNC_KEY` - Shared secret for the authenticated periodic Phyllo sync endpoint (for Cloud Scheduler or other cron drivers)
- `PHYLLO_PERIODIC_SYNC_MS` - Optional server poll interval for Phyllo backfill syncs
- `PHYLLO_PERIODIC_SYNC_STARTUP_DELAY_MS` - Optional delay before the first periodic Phyllo poll after boot
- `PHYLLO_PERIODIC_SYNC_BATCH_SIZE` - Optional cap on connected Phyllo profiles scanned per periodic run

## Dev Setup
- Install dependencies: `pnpm install`
- Set up environment variables in `.env`
- Run Supabase migrations in `supabase/migrations/` against your project (see `docs/DATABASE_MIGRATIONS.md`). Saved plans / proposals require `023_saved_cart_proposals.sql`.
- Start dev server: `pnpm dev` or `expo start`
- Design-system lint gate: `pnpm lint:design-system`

## Constraints
- **Platform**: iOS, Android, Web (via Expo)
- **Database**: Must use Supabase PostgreSQL (no direct DB access)
- **Auth**: Must use Supabase Auth (no custom auth system)
- **Type Safety**: End-to-end type safety via tRPC

## Dependencies
- `@supabase/supabase-js` - Supabase client library
- `@trpc/server` - tRPC server
- `@trpc/client` - tRPC client
- `expo-router` - File-based routing
- `nativewind` - Tailwind CSS for React Native
- `react-native` - React Native framework
- `expo` - Expo framework
