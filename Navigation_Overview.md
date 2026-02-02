## Navigation Overview

### Decision Summary
We will **stabilize the bottom navigation per role** so the **nav never changes** while a user stays in their role. Each role owns a custom bottom nav, and **shared screens are routed through role-group wrappers** to keep that nav visible. This mirrors common industry patterns (Instagram/Uber/DoorDash): a stable tab bar for a role, with detail screens that do not swap the tab bar.

### Why This Decision
- Users get a consistent, predictable tab bar for their role.
- Shared screens (profile, messages, product details, etc.) can be accessed without switching navigation trees.
- Avoids Expo Router remapping the tab bar when jumping into another role group.

### Rules of the Road
1. **Exactly one role nav is active per role**:
   - Shopper/Client/Trainer/Manager/Coordinator each has its own tab layout group.
2. **Shared screens must be reachable via role wrappers**:
   - Each role group owns routes like `/(role)/messages`, `/(role)/profile`, `/(role)/bundle/[id]`.
3. **Never navigate into another role’s group** from within a role.
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
- Shared screens exist **through role wrappers**:
  - `/(role)/profile`
  - `/(role)/messages`, `/(role)/conversation/[id]`
  - `/(role)/trainer/[id]`, `/(role)/bundle/[id]`, `/(role)/bundle-editor/[id]`
  - `/(role)/checkout/*`, `/(role)/invite/*`, `/(role)/template-editor/*`, etc.

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

### 2) Shared Screens Must Be Routed via Role Wrappers
Shared screens **must** be accessed through the current role group so the bottom nav never changes.

Examples:
- Profile (`/(role)/profile`)
- Conversation (`/(role)/conversation/[id]`)
- Bundle detail (`/(role)/bundle/[id]`)

### 3) Avoid Cross-Group Navigation
Do not route from a role screen into another role group unless the user’s role actually changed.

Bad:
- `router.push("/(trainer)/settings")` when viewing as manager

Good:
- `router.push("/(manager)/profile")` or another role-aware wrapper inside the current group

### 4) “Role Portals”
Use a role helper or wrapper route to choose the correct route for a shared action (home, profile, messages, bundles).
This keeps role routing logic in one place and prevents accidental nav swaps.

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
