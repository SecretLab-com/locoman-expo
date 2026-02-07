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
