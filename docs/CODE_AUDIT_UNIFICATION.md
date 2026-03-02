# Code Audit: Unification and Componentization Opportunities

## Purpose

This audit identifies where the repo is structurally redundant and where we can safely consolidate code for better maintainability, consistency, and speed of change.

Scope:
- Frontend duplication across role-based screens
- Repeated UI/action patterns
- Repeated parsing/status mapping logic
- Backend router organization and repeated guard/mutation flow patterns

## Executive Summary

Top structural issues:
1. Very large, duplicated role screens (`manager`/`coordinator` user management, trainer/client deliveries)
2. Monolithic `server/routers.ts` (6172 lines) with repeated guard/update patterns
3. Repeated cross-platform confirm/alert handling
4. Repeated status metadata and JSON parser logic

Recommended strategy:
- **Quick wins first (low risk, high consistency):** shared dialogs, shared status maps, shared reschedule codec, standardized headers/navigation usage
- **Then deeper refactors:** split large router domains and extract feature modules for users/deliveries/payments

## Audit Method

- Reviewed architecture context and active codebase patterns.
- Scanned for repeated constants, repeated UI/state flows, and repeated mutation scaffolding.
- Verified hotspots with concrete file-level matches (`showAlert`, `Platform.OS === "web"`, `Alert.alert`, status dictionaries, repeated JSON parsing).

## Impact-Ranked Findings

### 1) Duplicate manager/coordinator user-management implementations

**Problem**
- The manager and coordinator users screens are near-copies with highly similar constants, list/detail modals, invite flows, and mutation wiring.

**Evidence**
- `app/(manager)/users.tsx`
- `app/(coordinator)/users.tsx`
- Duplicated constants: `ROLE_COLORS`, `STATUS_COLORS`, `ACTION_LABELS`, `ACTION_ICONS`, `ACTION_COLORS`

**Why it matters**
- Any fix or UX improvement must be implemented twice.
- High chance of role behavior drift.

**Unify via**
- `features/users-management/`:
  - `UsersManagementScreen`
  - `UsersToolbar`
  - `UsersTable`
  - `UserDetailSheet`
  - `InvitesPanel`
  - shared hooks: `useUsersFilters`, `useUsersMutations`
- Thin wrappers by role for capabilities/permissions.

**Risk**
- Medium (large-file extraction), but high payoff.

---

### 2) `server/routers.ts` is monolithic

**Problem**
- A single 6172-line file owns many domains.

**Evidence**
- `server/routers.ts`

**Why it matters**
- Slows reviews, increases merge conflicts, and makes regression debugging harder.

**Unify via**
- Domain routers:
  - `server/routers/payments.router.ts`
  - `server/routers/deliveries.router.ts`
  - `server/routers/orders.router.ts`
  - `server/routers/admin.router.ts`
  - etc.
- Shared router helpers/middleware in `server/routers/_shared/`.

**Risk**
- Medium-high (needs careful migration/testing).

---

### 3) Repeated guard/load/update mutation flows in backend

**Problem**
- Repeated pattern: load entity -> not-found check -> access assert -> mutation -> side effects.

**Evidence**
- Repeated access helpers and mutation shapes in `server/routers.ts` (orders/deliveries/payments sections).

**Why it matters**
- Easy to miss authorization invariants or notification side effects.

**Unify via**
- Higher-order helpers:
  - `withOrderAccess(...)`
  - `withDeliveryAccess(...)`
  - `withPaymentOwnership(...)`
- Shared mutation runner utility for standard lifecycle.

**Risk**
- Medium.

---

### 4) Deliveries screens duplicated across trainer and client

**Problem**
- Trainer/client deliveries repeat status tabs, method labels, reschedule parsing, color mapping, row rendering patterns.

**Evidence**
- `app/(trainer)/deliveries.tsx`
- `app/(client)/deliveries.tsx`
- Duplicates: `STATUS_TABS`, `METHOD_LABELS`, `RESCHEDULE_REQUEST_PREFIX`, `parseRescheduleRequest`, `getStatusColor`

**Why it matters**
- Behavior drift and duplicate bug surface.

**Unify via**
- `features/deliveries/`:
  - `delivery-status.ts`
  - `reschedule-codec.ts`
  - `DeliveryListItem`
  - shared filter/state hook
- Keep role-specific actions as injected props.

**Risk**
- Medium.

---

### 5) Cross-platform confirm/alert duplication

**Problem**
- Many screens branch on web/native to run `window.confirm/window.alert` vs `Alert.alert`.

**Evidence**
- Repeated `showAlert` style helpers in:
  - `app/(trainer)/offers/new.tsx`
  - `app/(trainer)/payment-setup.tsx`
  - `app/(trainer)/request-payment.tsx`
  - `app/(trainer)/invite.tsx`
  - `app/(coordinator)/templates.tsx`
  - `app/(coordinator)/template-settings.tsx`
  - `app/(trainer)/clients.tsx`
  - `app/bundle-editor/[id].tsx`
- Many direct `window.confirm` usages across app screens.

**Why it matters**
- Inconsistent UX and higher chance of web callback issues.

**Unify via**
- `lib/dialogs.ts`:
  - `notify(title, message?)`
  - `confirm(title, message, options?) => Promise<boolean> | boolean`
  - `prompt(...)` as needed

**Risk**
- Low.

---

### 6) Status metadata duplicated and diverging

**Problem**
- Status labels/colors are defined in many places for similar concepts.

**Evidence**
- Offer status maps in:
  - `app/(trainer)/offers/index.tsx`
  - `app/(trainer)/invite.tsx`
  - `app/(trainer)/index.tsx`
- Payment labels/badges in:
  - `app/(trainer)/payment-history.tsx`
  - server mapping in `server/domains/payments.ts`

**Why it matters**
- UI state semantics can drift from backend truth.

**Unify via**
- `shared/status-meta.ts` with typed dictionaries (labels, tones, order).
- Screen-level badge component consumes canonical map.

**Risk**
- Low-medium.

---

### 7) Repeated JSON parsing/coercion for bundles/templates

**Problem**
- Multiple local `JSON.parse` wrappers parse product/service/goal arrays differently.

**Evidence**
- `app/(trainer)/offers/new.tsx`
- `app/template-editor/[id].tsx`
- `app/(trainer)/templates.tsx`
- `app/bundle/[id].tsx`
- `server/routers.ts` parsing helpers

**Why it matters**
- Inconsistent edge-case handling and subtle data bugs.

**Unify via**
- `shared/parsers/catalog-json.ts`:
  - `safeArray`
  - `parseProducts`
  - `parseServices`
  - `parseGoals`
  - `countItems`

**Risk**
- Medium (contract compatibility required).

---

### 8) Reschedule request protocol duplicated in server + both clients

**Problem**
- Prefix and encode/decode logic repeated in three places.

**Evidence**
- `server/routers.ts`
- `app/(trainer)/deliveries.tsx`
- `app/(client)/deliveries.tsx`

**Why it matters**
- Protocol drift risk (hard-to-debug parse failures).

**Unify via**
- `shared/reschedule-request.ts` with single encode/decode contract.

**Risk**
- Low-medium.

---

### 9) Role navigation/path derivation repeated in screens

**Problem**
- Local role-to-path logic appears despite existing navigation helpers.

**Evidence**
- Several role-aware screens still implement local route branching.
- Existing helper module: `lib/navigation.ts`

**Why it matters**
- Route drift and inconsistent navigation behavior.

**Unify via**
- Expand `lib/navigation.ts` with `getRoleBasePath(role)` and route builders.
- Replace local branching with helpers.

**Risk**
- Low.

---

### 10) Header/back-action patterns are hand-rolled repeatedly

**Problem**
- Multiple screens implement near-identical back/header blocks.

**Evidence**
- Existing shared header components:
  - `components/navigation-header.tsx`
  - `components/ui/screen-header.tsx`
- Many screens still use local custom touchables/rows for equivalent behavior.

**Why it matters**
- Inconsistent spacing/accessibility/test IDs and duplicated styling tweaks.

**Unify via**
- Pick one primary header API and standardize usage.
- Keep one component for page titles, one for nav-level controls (if both required).

**Risk**
- Low-medium.

---

### 11) Mutation boilerplate repeated across screens

**Problem**
- Similar mutation handling repeated: spinner state, haptics, alert handling, query invalidation.

**Evidence**
- Repeated patterns across:
  - `app/(trainer)/partnerships.tsx`
  - `app/(manager)/approvals.tsx`
  - `app/(trainer)/payment-history.tsx`
  - `app/(coordinator)/templates.tsx`
  - others

**Why it matters**
- Inconsistent error handling and cache invalidation.

**Unify via**
- `hooks/use-action-mutation.ts`:
  - wraps `trpc.*.useMutation`
  - accepts success/error messages
  - optional haptics
  - centralized invalidation strategy

**Risk**
- Medium.

---

### 12) Payment action logic fragmented across multiple trainer screens

**Problem**
- Create/cancel/remind/share logic is split across request/history/get-paid surfaces.

**Evidence**
- `app/(trainer)/get-paid.tsx`
- `app/(trainer)/request-payment.tsx`
- `app/(trainer)/payment-history.tsx`
- `server/domains/payments.ts`

**Why it matters**
- Payment UX changes require multi-file edits and can desync.

**Unify via**
- `features/payments/`:
  - `usePaymentActions`
  - `PaymentStatusBadge`
  - `PaymentHistoryItem`
  - `formatters.ts`

**Risk**
- Medium.

## Quick Wins Backlog (Do First)

1. Add `lib/dialogs.ts` and remove local `showAlert`/confirm branches.
2. Centralize status metadata in `shared/status-meta.ts`.
3. Extract `shared/reschedule-request.ts`.
4. Standardize on one header pattern (`ScreenHeader` and/or `NavigationHeader`).
5. Replace local role path branching with `lib/navigation.ts` helpers.

Expected result: faster consistency gains with low regression risk.

## Deep Refactor Roadmap

### Phase 1: Backend decomposition
- Split `payments` and `deliveries` out of `server/routers.ts`.
- Add shared guard wrappers for common mutation lifecycle.

### Phase 2: Deliveries feature module
- Create `features/deliveries` shared constants/parsers/components.
- Migrate trainer and client deliveries screens onto shared primitives.

### Phase 3: Users management feature module
- Extract shared users-management feature from manager/coordinator screens.
- Keep role wrappers thin and capability-driven.

### Phase 4: Payments feature module
- Consolidate payment action handlers and shared UI components.

## Target Shared Modules

- `lib/dialogs.ts`
- `shared/status-meta.ts`
- `shared/reschedule-request.ts`
- `shared/parsers/catalog-json.ts`
- `features/deliveries/*`
- `features/payments/*`
- `features/users-management/*`
- `server/routers/_shared/*`

## Testing Strategy for Safe Migration

- Add unit tests for:
  - status maps and badge tokens
  - shared JSON parsers
  - reschedule encode/decode contract
- Add API parity tests when splitting router domains.
- For each migrated screen:
  - verify action button loading state remains item-scoped
  - verify web confirm flows still work
  - verify accessibility labels/test IDs on extracted components

## Rollout Rules

- Migrate one vertical slice at a time (do not refactor everything at once).
- Keep old and new paths behaviorally identical before deleting old code.
- Prefer additive extraction first, then replace callsites incrementally.

## Definition of Done (for this unification effort)

- `server/routers.ts` split into domain modules with unchanged API surface.
- Duplicated deliveries and users screens share feature modules.
- Dialog and status behavior centralized and reused everywhere.
- JSON parsing and reschedule protocol are single-source shared modules.
- New features can be added by changing shared primitives first, not many screens.
