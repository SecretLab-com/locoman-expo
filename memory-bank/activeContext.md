# Active Context

## Current Focus
- **Calendar UI redesign**: Google Calendar-style layout with fixed compact grid at top, scrollable sessions below
- **Reschedule requests**: Full workflow with approve/reject/counter-propose UI on calendar alerts
- **AI Assistant**: OpenRouter LLM (Gemini 2.5 Flash) with tool-calling, vision, and voice input
- **Google Calendar integration**: Two-way sync, auto-create "Locomotivate" calendar, event deletion on cancellation
- **Accessibility audit**: Adding `accessibilityRole`, `accessibilityLabel`, and `testID` to interactive components

## Recent Changes
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

## Next Steps / Remaining TODOs
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
