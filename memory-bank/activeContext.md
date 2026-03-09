# Active Context

## Current Focus
- **Calendar UI redesign**: Google Calendar-style layout with fixed compact grid at top, scrollable sessions below
- **Reschedule requests**: Full workflow with approve/reject/counter-propose UI on calendar alerts
- **AI Assistant**: OpenRouter LLM (Gemini 2.5 Flash) with tool-calling, vision, and voice input
- **Google Calendar integration**: Two-way sync, auto-create "Locomotivate" calendar, event deletion on cancellation
- **Accessibility audit**: Adding `accessibilityRole`, `accessibilityLabel`, and `testID` to interactive components
- **Campaign post attribution**: Rule-based social post matching and attribution-backed campaign compliance
- **Trainer home social-state UX**: Cached social card state with skeleton fallback to prevent invite-state flicker for signed-up trainers

## Recent Changes
- **Phyllo dual-path sync**: Social data now syncs through both webhook ingestion and direct API pulls; manual/connect syncs backfill content rows, and the server periodically polls connected Phyllo profiles into Supabase so missed webhooks no longer leave the UI empty
- **Phyllo recent-post autofill**: The `socialProgram.recentPosts` query now self-heals empty trainer content by triggering a direct Phyllo pull when a connected `phylloUserId` exists, so the UI can populate posts even before a webhook or scheduled poll has written them
- **Phyllo manual full sync**: The visible `Sync now` action on `social-progress` now runs the full manual Phyllo sync path, including profile refresh, direct content pull, campaign post attribution refresh, and campaign metrics invalidation in the UI
- **Phyllo production ops**: `DEPLOYMENT_GUIDE.md` now includes the exact Cloud Run env vars and Cloud Scheduler create/update commands for the deployed backend (`locoman-486301`, `us-central1`, `locoman-backend`) using the authenticated periodic-sync endpoint
- **Phyllo V/MO fallback**: Trainer social cards now derive `V/MO` from imported recent-post views when profile-level monthly views are missing, and the pull sync persists that fallback into `avgViewsPerMonth` so YouTube view data no longer displays as zero
- **Connected services impressions fallback**: The `social-progress` connected-services list now merges imported recent-post view totals into per-platform impressions and uses subscriber-count fallbacks for YouTube followers, so the YouTube service row no longer shows `0` when synced post metrics exist
- **Manual payout KYC workflow**: Replaced the trainer Adyen link-out flow with a manual-first Bright.Blue intake + status tracker. Trainers now submit minimal account-holder details in-app, coordinators/managers manage status in a dedicated KYC queue, and social management shows payout KYC summary/status visibility.
- **Adyen-aligned KYC statuses**: Bright.Blue payout onboarding now tracks the user-facing states `Start setup`, `Details submitted`, `Verification required`, `Under review`, `More information required`, `Active`, `Verification failed`, and `Account rejected`, with the KYC doc updated to map these to Adyen's lower-level verification outcomes.
- **Offer wizard AI images**: The actual trainer offer wizard at `app/(trainer)/offers/new.tsx` now supports AI image generation and persists `imageUrl` through the offer create/update routes, rather than only the legacy bundle editor supporting generated images.
- **Counter-propose UI**: Reschedule request alerts now include a "Suggest" button that expands an inline form for date/time/note counter-proposals
- **Client spending categorization**: Orders now categorized as sessions/subscriptions/products based on description and fulfillment method (was previously all "products")
- **Accessibility labels**: Added `accessibilityRole="button"`, `accessibilityLabel`, and `testID` to trainer MoreRow components
- **Calendar layout**: Redesigned to Google Calendar mobile style (fixed compact grid, scrollable session list)
- **Schedule form**: Light mode support, field chaining (Next/Done buttons), auto-scroll to focused inputs, inline validation
- **AI Assistant (Loco Assistant)**: Full-featured chat with OpenRouter LLM, tool-calling for business data, vision support for images
- **Voice input**: Mic button in chat input, records audio, transcribes via Groq Whisper, auto-sends for assistant chats
- **OpenRouter LLM**: Replaced Forge API with OpenRouter for cost-effectiveness and multi-provider flexibility
- **Google Calendar sync**: Two-way sync creates reschedule requests for moved events, cancels sessions for deleted events
- **Auto-create Locomotivate calendar**: `googleCalendar.connectWithCode` creates dedicated calendar if none exists
- **Modal backgrounds**: Fixed transparency/overlap issues across 16 files using inline styles instead of NativeWind className
- **Sponsored products**: Database schema for trainer bonus, sponsored_by, bonus_expires_at, is_sponsored fields
- **MCP server**: HTTP routes with auto-refresh for expired JWT tokens, graceful skip in production builds
- **OpenClaw MCP**: Connection endpoint, token auto-refresh, role-based visibility in settings
- **Bundle creation from templates**: Copies template product/service/goal data, pre-populates form fields
- **Campaign post attribution**: Added posting rules on campaign account metadata, durable post-to-campaign attribution storage, webhook-time matching, attribution-backed campaign metrics, and trainer/coordinator compliance UI
- **Trainer home social card**: Added local `AsyncStorage` cache for `socialProgram.myStatus`, trusted stale active/connected states, and skeleton fallback when no trustworthy social status is available yet
- **WebSocket offline noise**: Client websocket hook now pauses reconnect attempts and suppresses expected offline disconnect spam until the network is restored

## Next Steps / Remaining TODOs
- **Phyllo ops hardening**: Consider admin visibility/replay tooling for failed or delayed Phyllo webhook/poll sync runs
- **Campaign attribution backfill ops**: Consider adding an explicit admin backfill/replay action for historical posts if campaign rules change at scale
- **Google Calendar webhook**: Real-time push notifications from Google (currently polling-based sync)
- **Partnerships**: Still using mock data, needs real API
- **Checkout flow**: Needs completion and payment processing integration (Adyen Drop-in requires native module setup)
- **Revenue analytics**: Some mock data remains, needs real calculations
- **Testing**: Full end-to-end testing of all flows

## Decisions
- **OpenRouter over Forge**: Chosen for cost control and multi-provider flexibility (Gemini 2.5 Flash default)
- **Groq Whisper**: Used for speech-to-text (whisper-large-v3 model)
- **Reschedule requests over auto-update**: Google Calendar moves create approval requests instead of auto-changing sessions
- **Supabase as single source**: Database + Auth provider
- **Service role key**: Used for all server-side DB operations (bypasses RLS)
- **Snake_case in DB**: Postgres uses snake_case, app code uses camelCase with conversion layer
- **Inline styles for modals on web**: NativeWind className unreliable inside React Native Modal on web
