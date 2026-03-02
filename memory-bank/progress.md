# Progress

## What Works
- **AI Assistant (Loco Assistant)**: Full chat with OpenRouter LLM (Gemini 2.5 Flash), tool-calling for business data, vision support, voice input via Groq Whisper
- **Google Calendar integration**: OAuth connect, auto-create "Locomotivate" calendar, two-way sync, event creation/deletion, reschedule request workflow (approve/reject/counter-propose)
- **Calendar UI**: Google Calendar-style layout with fixed compact grid, scrollable session list, schedule form with light mode, field chaining, validation
- **Voice input**: Mic button in chat, real-time waveform visualization (Web Audio API on web, expo-audio metering on native), Groq Whisper transcription
- **3-mode storefront browsing**: Bundles, Categories, and Products modes with Shopify collection-backed categories
- **Sponsored products**: Database schema and bundle template support for trainer bonuses and sponsored items
- **Bundle creation from templates**: Full workflow copying template data, pre-populating form, product image matching
- **Product detail screen**: Bottom-up modal with contained images, safe HTML rendering, sponsored bonus info
- **MCP server**: HTTP routes with JWT auto-refresh, stdio mode for Cursor, graceful production fallback
- **OpenClaw connection**: Settings UI (role-gated), token auto-refresh
- **Client spending**: Categorized by sessions/subscriptions/products based on order metadata
- **User invitation management**: Revoke, resend, invite-based registration with pre-filled fields
- **Database Migration**: Complete (Supabase PostgreSQL, 20+ tables, RLS, RPC functions)
- **Authentication**: Supabase Auth (Google OAuth, password test accounts, JWT throughout)
- **API Integration**: 20+ screens using real tRPC API calls across all roles
- **WebSocket**: Real-time messaging with typing indicators and Supabase JWT auth
- **Accessibility**: MoreRow components have accessibilityRole/Label/testID (trainer + coordinator)
- **Navigation**: Expo Router across all user roles
- **Styling**: NativeWind with inline style fallbacks for modals on web

## What's Left
- **Google Calendar webhook**: Push notifications for real-time sync (currently poll-based)
- **Partnerships**: Still using mock data
- **Checkout flow**: Needs completion and payment processing (Adyen native integration)
- **Revenue analytics**: Some mock data remains
- **Testing**: Full end-to-end testing
- **Accessibility audit**: Continue adding labels to remaining interactive components across all screens

## Current Status
- **Phase 1 (Database Migration)**: Complete
- **Phase 2 (Supabase Auth)**: Complete
- **Phase 3 (API Integration)**: Complete (20+ screens)
- **Phase 4 (WebSocket Auth)**: Complete
- **Phase 5 (Performance)**: N+1 queries fixed
- **Phase 6 (Error Handling)**: Complete
- **Phase 7 (Legacy Cleanup)**: Old SDK removed
- **Phase 8 (AI Assistant)**: Complete (OpenRouter + tools + vision + voice)
- **Phase 9 (Google Calendar)**: Complete (two-way sync + reschedule workflow)
- **Phase 10 (Calendar UI)**: Complete (Google Calendar-style layout)
- **Phase 11 (Sponsored Products)**: Schema complete, UI in progress
- **Phase 12 (MCP/OpenClaw)**: Complete

## Known Issues
- **Partnerships**: Mock data still in use
- **Checkout**: Flow incomplete
- **Revenue Analytics**: Some calculations still use mock data
- **iOS audio waveform**: May need `isMeteringEnabled: true` explicitly on some devices
