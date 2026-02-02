## Navigation Overview

### Decision Summary
We will **stabilize the bottom navigation per role** by keeping a single role-specific tab layout active at a time and treating all shared screens as stack screens that sit **above** that role’s tabs. This mirrors the most common industry pattern (Instagram/Uber/DoorDash): a stable tab bar for a role, with modal/stack screens on top that do not swap the tab bar.

### Why This Decision
- Users get a consistent, predictable tab bar for their role.
- Shared screens (profile, messages, product details, etc.) can be accessed without switching navigation trees.
- Avoids Expo Router remapping the tab bar when jumping into another role group.

### Rules of the Road
1. **Exactly one tab layout is active per role**:
   - Shopper/Client/Trainer/Manager/Coordinator each has its own tab layout group.
2. **Shared screens must live in the root stack** (outside role groups):
   - These screens should be pushed on top of the current role tab layout.
3. **Never navigate into another role’s group** from a shared screen.
   - Use role-aware helpers to return home without switching groups.
4. **Role switching only happens at authentication/impersonation boundaries**.
5. **Bottom nav should not be auto-generated across roles**; only the current role’s tab layout renders.

---

## Current Navigation Tree (Conceptual)

Root Stack (`app/_layout.tsx`)
- `/(tabs)` → Unified shopper-like tabs (role-adaptive content)
- `/(client)` → Client tabs
- `/(trainer)` → Trainer tabs
- `/(manager)` → Manager tabs
- `/(coordinator)` → Coordinator tabs
- Shared stack screens (no tab bar):
  - `/profile`
  - `/messages`, `/conversation/[id]`
  - `/trainer/[id]`, `/bundle/[id]`, `/bundle-editor/[id]`
  - `/checkout/*`, `/invite/*`, `/template-editor/*`, etc.

Role Tab Layouts
- **Unified Tabs** (Shopper-like)
  - Home, Products, Trainers/Users, Cart/Approvals, Profile
- **Client Tabs**
  - Home, Orders, Deliveries, Subscriptions, Revenue
- **Trainer Tabs**
  - Home, Calendar, Clients, Deliveries (others hidden)
- **Manager Tabs**
  - Home, Approvals, Users (others hidden)
- **Coordinator Tabs**
  - Home, Logs

---

## Implementation Guidelines

### 1) Role-Aware Home Navigation
All “Home” buttons should use the role-aware helper:
- `navigateToHome({ isCoordinator, isManager, isTrainer, isClient })`

This ensures home buttons always return to the correct tab layout.

### 2) Shared Screens Must Be in Root Stack
Shared screens should not live under role groups. They belong to the root stack so the tab bar stays stable underneath.

Examples:
- Profile (`/profile`)
- Conversation (`/conversation/[id]`)
- Bundle detail (`/bundle/[id]`)

### 3) Avoid Cross-Group Navigation
Do not route from a shared screen into another role group unless the user’s role actually changed.

Bad:
- `router.push("/(trainer)/settings")` when viewing as manager

Good:
- `router.push("/profile")` or a role-aware screen inside the current group

### 4) “Role Portals”
Use a “portal” helper or component to choose the correct route for a shared action (home, profile, orders).
This keeps role routing logic in one place and prevents accidental tab swaps.

---

## Recommended Next Step (If Needed)
If Expo Router’s group switching still causes tab swaps in edge cases, we can:
1. **Flatten shared screens** and ensure all shared routes exist only at root.
2. **Use a custom tab bar component** if needed, but keep it role-specific.
3. Add guardrails in navigation helpers to prevent cross-group pushes.

---

## Practical Example
- User is a manager on `/profile`.
- Pressing Home uses `navigateToHome({ isManager: true })`.
- Route resolves to `/(manager)` and preserves the manager tabs.

---

## Files of Interest
- `app/_layout.tsx` (root stack and shared screens)
- `app/(tabs)/_layout.tsx` (unified tabs)
- `app/(client)/_layout.tsx`
- `app/(trainer)/_layout.tsx`
- `app/(manager)/_layout.tsx`
- `app/(coordinator)/_layout.tsx`
- `lib/navigation.ts` (role-aware routing helpers)
