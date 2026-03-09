# Current Status Review (Codex53)

Date: February 10, 2026  
Project: `locoman-expo`

## Findings (Ordered by Severity)

1. High: Role escalation is hardcoded by email in server auth flow. Any login with mapped addresses is auto-promoted.
   - `server/_core/auth-utils.ts:9`
   - `server/_core/auth-utils.ts:55`
   - `server/_core/auth-utils.ts:78`
   - `server/_core/auth-utils.ts:80`
   - `server/db.ts:556`
   - `server/db.ts:560`
   - `hooks/use-auth.ts:13`
   - `hooks/use-auth.ts:72`

2. High: Messaging is split; main role routes point to a mock thread screen that does not send via API.
   - `app/messages/[id].tsx:40`
   - `app/messages/[id].tsx:48`
   - `app/messages/[id].tsx:222`
   - `app/(client)/messages/[id].tsx:1`
   - `app/(trainer)/messages/[id].tsx:1`
   - `app/(manager)/messages/[id].tsx:1`
   - `app/(coordinator)/messages/[id].tsx:1`
   - `app/messages/new.tsx:169`
   - `app/messages/new.tsx:177`
   - `app/trainer/[id].tsx:102`
   - `app/my-trainers/index.tsx:245`
   - Real implementation exists at `app/conversation/[id].tsx:439`, `app/conversation/[id].tsx:469`

3. High: Checkout and invitation acceptance are still mocked/simulated, so core monetization flow is incomplete.
   - `app/checkout/index.tsx:1`
   - `app/checkout/index.tsx:190`
   - `app/invite/[token].tsx:48`
   - `app/invite/[token].tsx:55`
   - `app/invite/[token].tsx:111`
   - `app/invite/[token].tsx:198`
   - Missing `orders.create` in `server/routers.ts:585`

4. High: Many DB mutation helpers swallow errors and return success to callers, making failures silent.
   - `server/db.ts:622`
   - `server/db.ts:624`
   - `server/db.ts:784`
   - `server/db.ts:786`
   - `server/db.ts:994`
   - `server/db.ts:996`
   - `server/db.ts:1114`
   - `server/db.ts:1116`
   - `server/db.ts:1407`
   - `server/db.ts:1412`
   - `server/db.ts:1580`
   - `server/db.ts:1582`

5. Medium-High: Guest routing is inconsistent; “Continue as guest” goes to `/(tabs)?guest=true`, but gate allowlist only permits specific routes and not tabs home.
   - `app/welcome.tsx:67`
   - `app/_layout.tsx:91`
   - `app/_layout.tsx:97`
   - `app/_layout.tsx:107`
   - `app/_layout.tsx:109`

6. Medium-High: Feature drift between frontend and backend; frontend TODOs claim missing endpoints that already exist.
   - Frontend TODOs:
     - `app/(client)/subscriptions.tsx:92`
     - `app/(client)/subscriptions.tsx:105`
     - `app/(client)/subscriptions.tsx:124`
     - `app/(client)/subscriptions.tsx:144`
     - `app/(trainer)/orders.tsx:133`
     - `app/(trainer)/orders.tsx:143`
   - Backend endpoints already present:
     - `server/routers.ts:472`
     - `server/routers.ts:483`
     - `server/routers.ts:494`
     - `server/routers.ts:607`

7. Medium-High: Large parts of manager/trainer experience are still mock-data screens.
   - `app/(manager)/index.tsx:19`
   - `app/(manager)/index.tsx:26`
   - `app/(manager)/analytics.tsx:16`
   - `app/(manager)/analytics.tsx:24`
   - `app/(manager)/deliveries.tsx:36`
   - `app/(manager)/deliveries.tsx:39`
   - `app/(trainer)/partnerships.tsx:45`
   - `app/(trainer)/partnerships.tsx:48`
   - `app/(trainer)/join-requests.tsx:30`
   - `app/(trainer)/join-requests.tsx:34`
   - `app/trainer/[id].tsx:80`

8. Medium: Test suite is mostly file-content assertions, not behavior/integration checks, and auth logout test is skipped.
   - `__tests__/comprehensive.test.ts:20`
   - `__tests__/comprehensive.test.ts:29`
   - `__tests__/features.test.ts:11`
   - `__tests__/features.test.ts:14`
   - `tests/auth.logout.test.ts:56`

9. Medium: Query filters use string interpolation in `.or(...)` clauses, which is fragile for special input.
   - `server/db.ts:669`
   - `server/db.ts:705`
   - `server/db.ts:1808`

10. Medium: Attachment upload accepts large base64 payloads with minimal validation; combined with 50MB JSON body limit, this is fragile under load.
   - `server/routers.ts:1052`
   - `server/routers.ts:1063`
   - `server/_core/index.ts:159`

11. Medium: Type drift around IDs increases integration risk (frontend uses numeric IDs in new-message flow while auth/user IDs are strings).
   - `app/messages/new.tsx:15`
   - `app/messages/new.tsx:25`
   - `app/messages/new.tsx:166`
   - `lib/_core/auth.ts:20`

12. Medium-Low: Architecture is overly monolithic and duplicated, increasing maintenance risk.
   - `server/routers.ts` ~2027 LOC
   - `server/db.ts` ~2047 LOC
   - `app/(manager)/users.tsx` ~2043 LOC
   - `app/(coordinator)/users.tsx` ~2044 LOC
   - Duplicated profile flows in `app/(tabs)/profile.tsx` and `app/profile/index.tsx`

13. Low: Register UX is misleading: collects password/confirm/trainer fields but always uses Google OAuth and leaves invite token unused.
   - `app/register.tsx:23`
   - `app/register.tsx:28`
   - `app/register.tsx:29`
   - `app/register.tsx:74`
   - `app/register.tsx:81`
   - `app/register.tsx:94`

## What Is Left To Implement (Core Gaps)

1. Real order creation / checkout pipeline (`orders.create` + payment + delivery creation).
2. Public invitation lookup/accept/decline flow by token.
3. Trainer-side join request moderation endpoints and UI wiring.
4. Admin-wide deliveries and revenue analytics endpoints.
5. Messaging consolidation: remove/replace mock `app/messages/[id].tsx` and standardize on real conversation API flow.
6. Replace silent DB mutation failures with explicit error propagation.
7. Replace superficial tests with integration tests for auth, messaging, checkout, invitations, and role permissions.

## Quality Assessment

The architectural foundation is standard and strong (Expo Router + tRPC + Supabase), but the current app is closer to a strong prototype than a production implementation because several critical paths remain mocked or partially wired.

Estimated production readiness: **55-65%**.

## Validation Snapshot

1. `pnpm check`: pass
2. `pnpm test`: pass (`350 passed`, `1 skipped`)
3. `pnpm lint`: pass with warnings (`47 warnings`, `0 errors`)

## Recommended Next Sequence

1. Remove hardcoded role elevation and ensure role assignment is data/admin driven.
2. Consolidate messaging route usage to the real conversation implementation.
3. Implement checkout + invitation backend endpoints and wire current TODO screens.
4. Add integration tests that exercise real tRPC callers for auth and permission enforcement.

---

## Implementation Update (Codex follow-up)

Completed in this pass:

1. Role-elevation hardcoding removed from auth flow and client fallback (`server/_core/auth-utils.ts`, `hooks/use-auth.ts`, `scripts/seed-defaults.ts`).
2. Messaging route consolidation:
   - `app/messages/[id].tsx` now routes to real conversation implementation.
   - Message entry points now navigate to `/conversation/[id]` with participant IDs.
3. Checkout implementation:
   - Added `orders.create` mutation in `server/routers.ts`.
   - Wired checkout UI to real `trpc.orders.create` in `app/checkout/index.tsx`.
4. Invitation implementation:
   - Added public invitation lookup + accept + decline endpoints in `catalog` router.
   - Added invitation DB update helper.
   - Wired `app/invite/[token].tsx` to real tRPC invitation flow.
5. Trainer join-request moderation:
   - Added DB helpers and tRPC endpoints for trainer pending request listing + approve/reject.
   - Wired `app/(trainer)/join-requests.tsx` to these endpoints.
   - Wired trainer profile request-to-join action to real mutation.
6. Feature-drift cleanup:
   - Wired subscription pause/resume/cancel UI to existing backend endpoints.
   - Wired trainer orders status actions to existing `orders.updateStatus`.
7. Manager data de-mocking:
   - Added admin endpoints for deliveries, low inventory, revenue summary, and revenue trend.
   - Wired manager dashboard/analytics/deliveries screens to real tRPC data.
8. Test hardening:
   - Unskipped and fixed `tests/auth.logout.test.ts`.
   - Added router integration tests: `tests/router.integration.test.ts`.
   - Updated brittle messaging thread assertion in `__tests__/features.test.ts`.
9. Additional hardening:
   - Replaced unsafe direct search interpolation usage with sanitized search terms in key DB queries.
   - Added attachment upload payload validation + 8MB decoded size cap in `messages.uploadAttachment`.
   - Fixed guest browse route mismatch by routing welcome guest flow to an allowlisted tab path.
   - Changed key DB mutation helpers to throw on write failures instead of silently swallowing errors.
10. Continued implementation:
   - Added manager template management endpoints for list/update/delete (`admin.templates`, `admin.updateTemplate`, `admin.deleteTemplate`).
   - Added DB helpers for template CRUD updates and bundle draft deletion.
   - Wired manager templates UI actions (activate/deactivate/delete) to real tRPC mutations.
   - Wired trainer bundles delete action to real `trpc.bundles.delete` mutation.
   - Wired bundle editor delete action to real `trpc.bundles.delete` mutation.

Validation after update:

1. `pnpm check`: pass
2. `pnpm test`: pass (`356 passed`, `0 failed`)

## Implementation Update (Codex continuation)

Completed in this continuation:

1. Template editor de-mocked and fully wired:
   - Added `admin.template` endpoint for single-template fetch in `server/routers.ts`.
   - Extended template create/update payload support with optional `goalsJson`, `imageUrl`, and `active`.
   - Replaced local fake save flow in `app/template-editor/[id].tsx` with real `trpc.admin.createTemplate` / `trpc.admin.updateTemplate`.
   - Added real loading/error states for template edit mode and robust parsing for stored template JSON data.
2. Manager templates refresh consistency:
   - Fixed pull-to-refresh invalidation key in `app/(manager)/templates.tsx` to use `utils.admin.templates.invalidate()`.
3. Trainer points activity de-mocking:
   - Added `trainerDashboard.pointHistory` endpoint in `server/routers.ts`, derived from trainer clients, sessions, and orders.
   - Wired `app/(trainer)/points.tsx` to real `trpc.trainerDashboard.pointHistory` data and removed empty-history placeholder behavior when data exists.
4. Test coverage update:
   - Added router integration test for `trainerDashboard.pointHistory` behavior in `tests/router.integration.test.ts`.
5. Client detail subscription TODO resolved:
   - Wired `app/client-detail/[id].tsx` to `trpc.subscriptions.get` for real subscription data.
   - Added bundle title hydration via `trpc.catalog.bundleDetail`.
   - Hardened subscription progress bar math to prevent divide-by-zero / overflow issues.
6. Client detail messaging action wired:
   - Replaced placeholder “Coming Soon” message action in `app/client-detail/[id].tsx` with real navigation to `/conversation/[id]` using linked client user IDs.
7. Sessions API gap closed:
   - Implemented `sessions.mySessions` in `server/routers.ts` to return real sessions for authenticated users based on linked trainer relationships.
   - Added integration coverage in `tests/router.integration.test.ts`.
8. Tier threshold consistency:
   - Aligned backend `trainerDashboard.points` tier cutoffs with the trainer UI tier table (`Silver: 1000`, `Gold: 5000`, `Platinum: 15000`).
   - Added integration coverage for tier thresholds in `tests/router.integration.test.ts`.
9. Admin template endpoint test coverage:
   - Added integration tests covering manager access and non-manager denial for `admin.template` in `tests/router.integration.test.ts`.
10. Partnerships feature implemented:
   - Added partnerships data model support in `server/db.ts` for businesses and trainer partnerships.
   - Added `partnerships` tRPC router in `server/routers.ts` with:
     - `list`
     - `availableBusinesses`
     - `request`
     - `submitBusiness`
   - Replaced mock-only implementation in `app/(trainer)/partnerships.tsx` with real tRPC queries/mutations.
   - Added Supabase migration for partnerships tables and default businesses: `supabase/migrations/002_partnerships.sql`.
   - Added router integration tests for partnerships in `tests/router.integration.test.ts`.
11. Session scheduling UI implemented:
   - Replaced “coming soon” add-session modal in `app/(trainer)/calendar.tsx` with real scheduling form wired to `trpc.sessions.create`.
   - Added client selection, time, duration, session type, location, and notes inputs.
   - Updated `app/client-detail/[id].tsx` “Schedule Session” action to route into calendar scheduling with preselected client context.
12. Invitation data-quality hardening:
   - Removed placeholder fallback emails from invite-link generation in `app/(trainer)/invite.tsx`.
   - Link generation and send-email flows now both enforce valid client email input.
13. Coordinator pending deliveries de-placeholder:
   - Replaced hardcoded pending deliveries value in `app/(coordinator)/index.tsx` with live `trpc.admin.deliveries` pending count.

Validation after continuation:

1. `pnpm check`: pass
2. `pnpm test`: pass (`364 passed`, `0 failed`)

## Implementation Update (Codex execution pass - February 11, 2026)

Completed in this pass:

1. Role hardening:
   - Removed hardcoded email-based coordinator elevation from `server/db.ts`.
   - Role promotion now only follows explicit role input or `OWNER_OPEN_ID`.
2. Payment-state correctness:
   - Updated order creation in `server/routers.ts` so non-zero orders default to `paymentStatus: "pending"` (not `"paid"`).
   - Applied to both checkout-created orders and invitation-acceptance orders.
   - Added `orderData.paymentRequired` to mark whether payment confirmation is still required.
3. Invitation acceptance UX cleanup:
   - Removed fake card-entry/mock-payment modal from `app/invite/[token].tsx`.
   - Acceptance now creates the order and clearly communicates that payment confirmation is pending.
4. Checkout confirmation accuracy:
   - Checkout now passes real `orderId` to confirmation route (`app/checkout/index.tsx`).
   - Confirmation screen now uses actual order ID param when available and updated copy to reflect pending payment state (`app/checkout/confirmation.tsx`).
5. Register onboarding context implementation:
   - Added persisted onboarding context helpers in `lib/onboarding-context.ts`.
   - `app/register.tsx` now saves selected `trainerId`/`inviteToken` before OAuth redirect.
   - Added `components/post-auth-onboarding-resolver.tsx` and mounted it in `app/_layout.tsx` to auto-apply post-auth intent:
     - Route to invite token page when present.
     - Auto-submit trainer join request when trainer was selected during registration.
6. Delivery reschedule hardening:
   - Implemented structured reschedule payload encoding/decoding (`reschedule_request_v1`) in `server/routers.ts`.
   - `deliveries.requestReschedule` now validates/records requested date + reason in structured form.
   - `approveReschedule` and `rejectReschedule` now parse request payload and write clearer notes.
   - Updated both trainer and client deliveries screens to parse and render structured reschedule requests:
     - `app/(trainer)/deliveries.tsx`
     - `app/(client)/deliveries.tsx`
7. Profile placeholder cleanup:
   - Removed remaining placeholder actions in profile screens and wired real behavior:
     - Tab profile now routes edit to settings and only shows orders for clients.
     - Help & support now opens support email/web URL.
     - Updated files:
       - `app/(tabs)/profile.tsx`
       - `app/profile/index.tsx`
8. Analytics filter wiring:
   - Wired manager/coordinator analytics period selector to backend months input instead of fixed 6 months:
     - `app/(manager)/analytics.tsx`
9. Test alignment:
   - Updated feature assertion for checkout confirmation copy in `__tests__/features.test.ts`.

Validation after this pass:

1. `pnpm check`: pass
2. `pnpm test`: pass (`364 passed`, `0 failed`)

## Remaining Priority Work (Updated)

1. Real client payment capture:
   - Orders are now correctly marked pending, but checkout/invitation still lack end-to-end client-side payment capture/authorization settlement flow.
2. Payment status lifecycle updates:
   - Need webhook or explicit reconciliation path to transition orders from `pending` -> `paid`/`failed`.
3. Delivery reschedule schema formalization:
   - Structured payload now works, but this should become first-class DB fields (`requested_date`, `requested_reason`, `requested_at`) for cleaner querying/reporting.
4. Owner bootstrap policy:
   - Email hardcoding is removed; decide whether `OWNER_OPEN_ID` bootstrap remains desired long-term or should move to explicit admin-managed role assignment only.

## Implementation Update (Codex continuation - payment capture wiring)

Completed in this continuation:

1. Real order payment provisioning:
   - Added backend helper `provisionOrderPaymentLink(...)` in `server/routers.ts`.
   - Checkout and invitation acceptance now attempt to create a real Adyen payment link for payable orders.
   - `orders.create` and `catalog.acceptInvitation` now return a `payment` payload with:
     - `required`
     - `configured`
     - `provisioned`
     - `paymentLink`
     - `merchantReference`
     - `expiresAt`
2. Payment retry endpoint:
   - Added `orders.createPaymentLink` mutation in `server/routers.ts` for re-generating payment links on pending orders.
3. Webhook reconciliation to order state:
   - Updated `/api/webhooks/adyen` handler in `server/_core/index.ts` to map payment events onto linked orders when `payment_sessions.order_id` exists.
   - Event mapping now updates order lifecycle:
     - `AUTHORISATION` success -> `paymentStatus: paid`, `status: confirmed`
     - `CAPTURE` success -> `paymentStatus: paid`, `status: processing`
     - `CANCELLATION` success -> `status: cancelled`
     - `REFUND` success -> `paymentStatus: refunded`, `status: refunded`
   - Payment logs are now linked to `payment_session_id` when available.
4. Client checkout UX integration:
   - `app/checkout/index.tsx` now handles returned `payment` payload and prompts to open payment link immediately.
   - `app/checkout/confirmation.tsx` now:
     - loads order payment state,
     - shows payment status,
     - exposes “Complete Payment” CTA via `orders.createPaymentLink`.
5. Invitation UX integration:
   - `app/invite/[token].tsx` now opens real payment links returned by invite acceptance flow when payment is required.
6. Payment DB hardening:
   - `db.updatePaymentSessionByReference` now throws on write failure instead of silently swallowing update errors.
7. Test updates:
   - Updated router integration coverage for new order create return shape and payment-link mutation behavior in `tests/router.integration.test.ts`.
8. Redirect completion endpoint:
   - Added `/api/payments/redirect` handler in `server/_core/index.ts` to safely return browser-based Adyen redirects back into the app deep link (`locomotivate://checkout/confirmation`).
9. Persistent pay-now UX for existing pending orders:
   - Added client orders “Pay Now” action in `app/(client)/orders.tsx`, wired to `orders.createPaymentLink` so users can complete payment after checkout/invite flows.

Validation after continuation:

1. `pnpm check`: pass
2. `pnpm test`: pass (`366 passed`, `0 failed`)

## Remaining Priority Work (Post-payment wiring)

1. In-app card checkout session UI:
   - Hosted payment links are now wired, but native/web embedded card checkout (Adyen Components/Drop-in) is still not implemented.
2. Payment status refresh UX:
   - Add automatic polling/refresh after returning from hosted payment pages so users see paid status updates without manual navigation.
3. Ops-level reconciliation and alerts:
   - Add admin/coordinator views and alerts for stale pending payments and failed/refused payment sessions.
4. Payment reliability hardening:
   - Add retry/idempotency safeguards and reconciliation jobs for edge cases where webhook delivery is delayed or missed.
