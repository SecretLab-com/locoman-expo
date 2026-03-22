# Progress

## What Works
- **Design system foundation**: Semantic color/spacing/radius/typography/elevation tokens now flow from `theme.config.js` through runtime theme helpers and NativeWind, so shared components have a centralized styling source of truth
- **Shared UI primitives**: Typography, surface, badge, icon-button, input, FAB, modal-surface, and divider primitives/recipes now exist and are being adopted by trainer/admin/shared UI
- **Raw-style enforcement**: A custom ESLint design-system rule now blocks new raw hex/rgba/font/shadow literals outside the explicit migration exception list, and `pnpm lint:design-system` verifies the gate
- **Exception-list reduction**: The follow-up design-system passes removed several already-clean files from `eslint/design-system-exceptions.js`, including `app/(client)/orders.tsx`, `app/oauth/callback.tsx`, `app/share-intent.tsx`, `app/(coordinator)/index.tsx`, `app/(trainer)/payment-history.tsx`, `app/(manager)/deliveries.tsx`, `app/campaign/[slug].tsx`, and `components/service-picker-modal.tsx`, while keeping `pnpm lint:design-system` at `0` errors
- **Trainer offer flow consolidation**: Trainer create/edit entry points now route to `bundle-editor`, trainer-facing offer screens now read bundle drafts through `trpc.bundles.*` and `shared/bundle-offer.ts`, and the duplicate `app/(trainer)/offers/new.tsx` / `trpc.offers.*` path has been retired
- **Trainer saved-cart bundle shopping**: Trainers can once again open the shopper-style bundle detail route from catalog browsing, add bundles into the saved-cart builder, and return to the trainer products route from the empty builder state while trainer/coordinator management lists keep using their scoped bundle detail routes
- **Trainer plan journey naming**: Trainer UI now presents the saved-cart flow as a clearer plan journey, with `Create Plan` leading to trainer shopping, `Review & Send` leading to the review/send screen, and `Create Plan` CTAs on trainer client list/detail screens preloading the selected client into the plan context
- **Focused plan-shopping flow**: Trainer plan shopping now opens as a dedicated fullscreen route (`/plan-shop`) with a Step 1 intro modal showing the client photo/name, a floating dismissable client chip, a plan-status footer with item count/subtotal/Done, a close button with unsaved-state confirmation, and no bottom nav. If no client is selected, trainers now go back to the clients list instead of a duplicate inline picker screen.
- **Product detail modal scrolling**: The product detail bottom sheet now allows long descriptions to scroll to the purchase CTA by keeping scroll gestures inside the content and bounding the sheet height on native
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
- **Campaign post attribution**: Campaign posting rules are stored on campaign account metadata, Phyllo content is attributed to campaign offers via hashtag/mention/link/platform/window checks, and campaign dashboards now read attribution-backed compliance counts
- **Trainer social card load behavior**: The trainer home screen now uses cached social membership/profile state plus a skeleton fallback so signed-up trainers do not briefly see the invite card on initial load
- **Exclusive social account ownership**: Trainer social connect/sync now blocks duplicate Phyllo/platform identities across trainers, and the database enforces unique `phyllo_user_id` ownership so one social account cannot be reused to defraud the program
- **Social conflict audit trail**: Coordinator/manager social management now shows recent duplicate-account blocks from `social_event_notifications`, so anti-fraud ownership conflicts are visible without digging through logs
- **Phyllo content recovery**: Manual sync/connect flows now pull recent content directly from Phyllo, webhook ingestion still applies live updates, and the server periodically backfills connected profiles into Supabase so social UI can recover from missed webhook delivery
- **Phyllo empty-post recovery**: When a connected trainer opens recent posts and Supabase is still empty, the backend now performs an on-demand Phyllo pull and returns the imported content in the same request
- **Phyllo manual sync button**: The social detail screen's `Sync now` button now triggers the full backend sync path and refreshes status, recent posts, and campaign metrics queries after completion
- **Phyllo V/MO persistence**: When Phyllo profile aggregates omit monthly views, imported content views now backfill `avgViewsPerMonth` and the trainer UI also falls back to recent-post view totals so the V/MO dial no longer stays at zero
- **Connected services impressions**: The trainer social detail screen now folds imported recent-post views into per-platform connected-service stats, so YouTube impressions/month reflects synced post data instead of stale zero-valued profile metadata
- **Payout onboarding workflow**: Trainers now complete an internal payout/KYC intake form instead of opening Adyen directly, trainers can track manual-first KYC state in-app, coordinators/managers can process and update KYC state from a dedicated queue, and social management now shows payout KYC summary/status alongside social metrics
- **Adyen status coverage**: The payout/KYC flow now tracks and displays the full app-facing Adyen status set requested by product, including retryable failure states and final rejection states, with trainer/admin UI and docs aligned to that model
- **Social member dashboard UX**: Social management now keeps the overview compact with a top-10 subscriber-ranked member list, uses tap-through member details for pause/activate/remove actions, and moves full-list search/sort/filter controls behind a `Manage` modal
- **Offer image generation**: The real trainer offer wizard now exposes AI image generation, and generated image URLs persist correctly through offer create/update reads instead of being confined to the legacy bundle editor path
- **Social membership lifecycle**: Coordinators/managers can now invite/pause/ban with visible in-screen feedback, trainers receive invite alerts plus invitation messages/notifications, non-invited trainers no longer receive social-program details from `myStatus`, and ban transitions are logged as `status_changed` entries that reset membership to `uninvited`
- **Trainer attribution model**: Dedicated `trainer_attributions` + `trainer_attribution_log` tables track which trainer is credited for a customer's purchases, with `store_link`, `invitation_acceptance`, `bundle_purchase`, and `manual` source types; upsert semantics on `customer_id` ensure most-recent-interaction wins
- **My Store Link**: Trainers have a shareable store link (`/shop/{username}`) on their profile; the landing page shows trainer context and routes shoppers into the storefront while setting attribution on authenticated users or saving a pending onboarding context for unauthenticated visitors
- **Per-product/bundle commissions**: Products and bundles now have an optional `commission_rate` column (default 10% when null); the paid-order pipeline creates `trainer_earnings` commission rows using per-item rates, and the trainer earnings screen shows commission, bonus, and sale types with distinct icons
- **Attribution in order pipeline**: Both invitation acceptance and proposal checkout upsert attribution; independent `orders.create` resolves the customer's current attributed trainer when no explicit trainer is on the cart; Shopify payloads carry `attributed_trainer_id` and `attribution_id` in `note_attributes`
- **Attributed purchase notifications**: A push notification is sent to the attributed trainer when a customer's independent purchase is paid, showing the purchase total and estimated commission

## What's Left
- **Exception-list burn-down**: `eslint/design-system-exceptions.js` still contains legacy screens/components that need deeper migration before the raw-style ban can be fully universal
- **Campaign attribution tooling**: No dedicated admin/manual reprocessing control yet for large historical backfills
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
