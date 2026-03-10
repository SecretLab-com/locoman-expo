# System Patterns

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **Backend**: Node.js server with tRPC for type-safe APIs
- **Database**: Supabase PostgreSQL as single source of truth
- **Auth**: Supabase Auth (replaces custom OAuth system)
- **Real-time**: Custom WebSocket server with Supabase JWT verification
- **Styling**: NativeWind (Tailwind CSS for React Native)

## Key Technical Decisions
- **Supabase as Single Provider**: Database + Auth in one platform (no separate auth system)
- **No ORM**: Direct Supabase JS client usage for flexibility and performance
- **Type Safety**: tRPC provides end-to-end type safety from database to frontend
- **Snake_case ↔ camelCase**: Database uses snake_case, app code uses camelCase with automatic conversion
- **UUID IDs**: All entity IDs are UUID strings (not auto-increment integers)
- **RPC Functions**: Complex queries use RPC functions to avoid N+1 problems
- **Service Role Key**: Server-side operations use service role key (bypasses RLS)
- **RLS Policies**: Enabled for potential future direct client access

## Design Patterns
- **Repository Pattern**: `server/db.ts` acts as database repository layer
- **Context Pattern**: React contexts for global state (cart, auth, etc.)
- **Custom Hooks**: Reusable hooks in `hooks/` directory
- **Shared Utilities**: Common utilities in `lib/` directory
- **Type Exports**: Database types exported from `server/db.ts`
- **Error Handling**: All DB queries wrapped with try/catch and proper error responses
- **Attribution Pipeline**: Social post compliance uses explicit campaign posting rules stored in campaign-account metadata, durable attribution rows per post/campaign match, then derives campaign metrics from those matched facts instead of trainer-wide snapshot fan-out
- **Phyllo Dual Sync Path**: Social profile/content ingestion should use webhooks as the fast path but also support direct API pull syncs that write the same Supabase tables (`trainer_social_profiles`, `trainer_social_metrics_daily`, `trainer_social_contents`, `trainer_social_content_activity_daily`) so periodic polling and manual refreshes can heal missed webhook deliveries
- **Trainer Home State Caching**: The trainer dashboard may hydrate sensitive UI state from local `AsyncStorage` snapshots first, then refresh with live tRPC data; stale "connected/active" social states are trusted to avoid invite flicker, while stale invite-only states are not
- **WebSocket Offline Gating**: Client websocket reconnects should respect device connectivity and pause retries/log spam while offline, then resume automatically when the network returns
- **Social Membership Lifecycle**: Social program access is controlled by both `trainer_social_memberships` and `trainer_social_invites`; banning a trainer should revoke pending invites and reset membership to `uninvited` rather than leaving a sticky banned state, and trainer-facing `myStatus` responses must hide profile/commitment/progress details whenever the trainer is not currently invited
- **Social Realtime Invalidation**: Client realtime invalidation must listen to `trainer_social_memberships`, `trainer_social_invites`, `trainer_social_profiles`, and `social_event_notifications` so invite/pause/ban flows refresh both coordinator management surfaces and trainer home/detail surfaces without manual reloads

## Component Relationships
- **Screens**: Organized by user role in `app/(role)/` directories
  - `(client)/` - Client user screens
  - `(trainer)/` - Trainer user screens
  - `(manager)/` - Manager user screens
  - `(coordinator)/` - Coordinator user screens
  - `(tabs)/` - Tab navigation screens
- **Shared Screens**: Common screens in `app/` root (browse, checkout, profile, etc.)
- **Components**: Reusable UI components in `components/`
- **Hooks**: Custom React hooks in `hooks/`
- **Contexts**: Global state contexts (cart-context.tsx, etc.)
- **Server**: Backend code in `server/`
  - `server/db.ts` - Database layer
  - `server/routers.ts` - tRPC routers
  - `server/_core/` - Core server utilities (auth, websocket, context)

## Data Flow
1. **Frontend** → tRPC client → **Backend** (tRPC server)
2. **Backend** → `server/db.ts` → **Supabase** (PostgreSQL)
3. **Auth**: Frontend → Supabase Auth → JWT token → Backend verification
4. **Real-time**: Frontend → WebSocket server → Supabase JWT verification → Real-time updates

## File Organization
- `app/` - Expo Router screens and navigation
- `components/` - Reusable React components
- `hooks/` - Custom React hooks
- `lib/` - Shared utilities and Supabase clients
- `server/` - Backend code (tRPC, database, WebSocket)
- `shared/` - Shared types and utilities
- `supabase/` - Supabase migrations and config
