# Navigation Escape Hatch Audit

**Ensuring No Dead Ends in LocoMotivate**

*Author: Manus AI*  
*Date: January 28, 2026*

---

## Audit Summary

This document analyzes every navigation destination in the proposed v2 navigation structure to ensure users can always return to their home screen. Each screen is categorized by its navigation type and assigned an appropriate escape mechanism.

---

## Screen Categories and Escape Patterns

### Pattern 1: Tab Screens (Always Accessible)

Tab screens are the "home base" for each role. Users can always reach these by tapping the tab bar, which remains visible at all times.

| Role | Tab Screens | Escape Method |
|------|-------------|---------------|
| Shopper | Discover, Cart | Tab bar always visible |
| Client | My Program, Deliveries | Tab bar always visible |
| Trainer | Today, Calendar, Clients, Deliveries, Earnings | Tab bar always visible |
| Manager | Command Center, People, Revenue | Tab bar always visible |
| Coordinator | Catalog, Impersonate, Logs | Tab bar always visible |

**Status: Safe** - Tab bar provides constant escape route.

---

### Pattern 2: Modal Sheets (Dismissible)

Modal sheets slide up from the bottom and can be dismissed by swiping down or tapping outside.

| Screen | Triggered From | Escape Method |
|--------|----------------|---------------|
| Checkout Sheet | Cart | Swipe down or X button |
| Payout Request Sheet | Today screen | Swipe down or X button |
| Product Sheet | Discover | Swipe down or X button |
| Share Invite Link | Invite flow | Swipe down or X button |

**Status: Safe** - Native iOS/Android sheet dismissal gestures work automatically.

---

### Pattern 3: Stack Screens (Need Back Button)

Stack screens push onto the navigation stack and require explicit back navigation.

| Screen | Triggered From | Current Escape | Recommended Escape |
|--------|----------------|----------------|-------------------|
| Bundle Detail | Multiple sources | Back button | Back button + Tab bar visible |
| Bundle Editor | My Bundles | Back button | Back button + Cancel confirmation |
| Trainer Profile | Discover, My Trainers | Back button | Back button + Tab bar visible |
| Trainer Detail | My Trainers | Back button | Back button |
| Messages List | Multiple sources | Back button | Back button + Tab bar visible |
| Message Thread | Messages List | Back button | Back button |
| Session View | My Program | Back button | Back button + "End Session" |
| Client Detail | Clients tab | Back button | Back button |
| User Detail | People tab | Back button | Back button |
| Trainer Admin View | People tab | Back button | Back button |
| Order Confirmation | Checkout | **POTENTIAL ISSUE** | "Continue Shopping" or "Go Home" |

**Status: Needs Review** - Most are safe, but Order Confirmation needs explicit home navigation.

---

### Pattern 4: Profile Menu Screens (Need Back Path)

Screens accessed from the profile menu need a clear path back.

| Screen | Parent | Escape Method |
|--------|--------|---------------|
| My Trainers | Profile Menu | Back button → Profile → Close |
| Spending History | Profile Menu | Back button → Profile → Close |
| Account Settings | Profile Menu | Back button → Profile → Close |
| Find New Trainer | My Trainers | Back button → My Trainers → Profile → Close |

**Status: Needs Attention** - Deep nesting (3+ levels) can feel like a dead end.

---

### Pattern 5: Auth Screens (Special Handling)

Authentication screens have unique navigation requirements.

| Screen | Entry Point | Escape Method |
|--------|-------------|---------------|
| Login | Profile menu, Invite page | Back button → Previous screen |
| Register | Login, Invite page | Back button → Login or Invite |
| Invitation Page | Deep link | Accept/Decline → Appropriate destination |

**Status: Safe** - Auth flow is linear with clear outcomes.

---

## Identified Dead-End Risks

### Risk 1: Order Confirmation Screen

**Problem:** After completing checkout, the confirmation screen shows "Order Confirmed" but the path forward is unclear.

**Current State:**
```
Cart → Checkout → Confirmation → ???
```

**Solution:** Add two clear CTAs:
1. "View My Program" → Navigate to Client's My Program tab
2. "Continue Browsing" → Navigate to Discover tab (for shoppers)

---

### Risk 2: Deep Profile Menu Navigation

**Problem:** Client navigating Profile → My Trainers → Find New Trainer → Trainer Profile is 4 levels deep.

**Current State:**
```
My Program → Profile → My Trainers → Find Trainer → Trainer Profile
                                                    ↓
                                              (4 levels deep, feels stuck)
```

**Solution:** Two approaches:

**Option A: Persistent Tab Bar**
Keep the tab bar visible even in profile screens. User can always tap "My Program" to escape.

**Option B: Home Button in Header**
Add a home icon in the header that returns to the first tab (My Program for clients).

**Recommended:** Option A (Persistent Tab Bar) - More consistent with iOS HIG.

---

### Risk 3: Bundle Editor Abandonment

**Problem:** Trainer editing a bundle may want to abandon changes but there's no clear "cancel" path.

**Current State:**
```
My Bundles → Bundle Editor → (making changes) → ???
```

**Solution:** 
- Back button shows confirmation: "Discard changes?"
- Add explicit "Cancel" button in header
- Auto-save drafts so work isn't lost

---

### Risk 4: Session View Exit

**Problem:** Client in an active session view may not know how to exit.

**Current State:**
```
My Program → Session View → (in session) → ???
```

**Solution:**
- Add "Leave Session" button (with confirmation)
- Show countdown timer with auto-return
- Tab bar remains visible for emergency exit

---

### Risk 5: Coordinator Impersonation

**Problem:** Coordinator impersonating a user may get "stuck" in that user's experience.

**Current State:**
```
Impersonate → Select User → (now viewing as user) → ???
```

**Solution:**
- Add persistent "Exit Impersonation" banner at top
- Banner is always visible regardless of navigation depth
- Tapping banner returns to Coordinator tabs

---

## Universal Escape Hatch Strategy

To ensure no screen is ever a dead end, implement these universal patterns:

### 1. Persistent Tab Bar Rule

The tab bar should remain visible on ALL screens except:
- Full-screen modals (checkout, auth)
- Media playback (video, session)
- Focused input (message compose)

Even profile menu screens should show the tab bar.

### 2. Back Button Consistency

Every non-tab screen must have:
- iOS: Back chevron in top-left
- Android: Back arrow in top-left + hardware back button support
- Web: Back arrow + browser back button support

### 3. Swipe Gesture Support

Enable iOS swipe-from-left-edge gesture on all stack screens for quick back navigation.

### 4. Emergency Home Button

For screens 3+ levels deep, add a home icon in the header that returns to the primary tab.

### 5. Confirmation on Destructive Back

When back navigation would lose unsaved work:
- Show confirmation dialog
- Offer "Save Draft" option
- Never silently discard changes

---

## Screen-by-Screen Escape Matrix

| Screen | Tab Bar Visible | Back Button | Swipe Back | Home Button | Notes |
|--------|-----------------|-------------|------------|-------------|-------|
| **Tab Screens** | ✅ | N/A | N/A | N/A | Always accessible |
| Bundle Detail | ✅ | ✅ | ✅ | ❌ | 1 level deep |
| Bundle Editor | ❌ | ✅ | ✅ | ✅ | Confirm on back |
| Trainer Profile | ✅ | ✅ | ✅ | ❌ | 1 level deep |
| Messages List | ✅ | ✅ | ✅ | ❌ | 1 level deep |
| Message Thread | ✅ | ✅ | ✅ | ❌ | 2 levels deep |
| My Trainers | ✅ | ✅ | ✅ | ❌ | Profile submenu |
| Find New Trainer | ✅ | ✅ | ✅ | ✅ | 3 levels deep |
| Trainer Detail | ✅ | ✅ | ✅ | ❌ | 2 levels deep |
| Session View | ❌ | ❌ | ❌ | ❌ | "Leave Session" button |
| Checkout Sheet | ❌ | ❌ | ✅ | ❌ | Swipe to dismiss |
| Order Confirmation | ❌ | ❌ | ❌ | ✅ | "Go Home" CTA |
| Payout Sheet | ❌ | ❌ | ✅ | ❌ | Swipe to dismiss |
| Client Detail | ✅ | ✅ | ✅ | ❌ | 1 level deep |
| Settings | ✅ | ✅ | ✅ | ❌ | Profile submenu |
| Login/Register | ❌ | ✅ | ✅ | ❌ | Auth flow |
| Invitation Page | ❌ | ❌ | ❌ | ❌ | Must accept/decline |

---

## Implementation Checklist

### Phase 1: Critical Fixes
- [ ] Add "Go Home" / "View Program" buttons to Order Confirmation
- [ ] Add "Exit Impersonation" banner for Coordinators
- [ ] Add confirmation dialog to Bundle Editor back navigation

### Phase 2: Tab Bar Visibility
- [ ] Keep tab bar visible on Bundle Detail
- [ ] Keep tab bar visible on Trainer Profile
- [ ] Keep tab bar visible on Messages screens
- [ ] Keep tab bar visible on Profile menu screens (My Trainers, Settings, etc.)

### Phase 3: Deep Navigation Helpers
- [ ] Add home button to screens 3+ levels deep
- [ ] Enable swipe-from-edge gesture on all stack screens
- [ ] Add "Leave Session" button to Session View

### Phase 4: Polish
- [ ] Ensure hardware back button works on Android
- [ ] Ensure browser back button works on Web
- [ ] Add haptic feedback on successful navigation

---

## Updated Navigation Flow with Escape Paths

```
┌─────────────────────────────────────────────────────────────────┐
│                     ESCAPE PATH LEGEND                          │
│  ───────► Forward navigation                                    │
│  ◄─ ─ ─ ─ Back button / swipe                                   │
│  ═══════► Tab bar tap (always available)                        │
│  ········► Home button (deep screens only)                      │
└─────────────────────────────────────────────────────────────────┘

CLIENT FLOW:
                    ════════════════════════════════
                    ║     TAB BAR (Always Visible)  ║
                    ║  [My Program]  [Deliveries]   ║
                    ════════════════════════════════
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Bundle  │   │ Messages │   │ Profile  │
        │  Detail  │   │   List   │   │   Menu   │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │◄─ ─ ─ ─      │◄─ ─ ─ ─      │
             │              ▼               ▼
             │        ┌──────────┐   ┌──────────┐
             │        │ Message  │   │   My     │
             │        │  Thread  │   │ Trainers │
             │        └────┬─────┘   └────┬─────┘
             │             │◄─ ─ ─ ─      │◄─ ─ ─ ─
             │             │              ▼
             │             │        ┌──────────┐
             │             │        │  Find    │
             │             │        │ Trainer  │
             │             │        └────┬─────┘
             │             │             │◄─ ─ ─ ─
             │             │             │·········► [Home]
             │             │             ▼
             │             │        ┌──────────┐
             │             │        │ Trainer  │
             │             │        │ Profile  │
             │             │        └──────────┘
             │             │             │◄─ ─ ─ ─
             ▼             ▼             │
        ════════════════════════════════════
        ║  TAB BAR - Tap to escape anywhere  ║
        ════════════════════════════════════
```

---

## Summary

The proposed navigation structure is fundamentally sound, but requires these additions to eliminate dead ends:

1. **Keep tab bar visible** on most stack screens (not just tab screens)
2. **Add explicit CTAs** to terminal screens (Order Confirmation)
3. **Add home button** to deeply nested screens (3+ levels)
4. **Add exit mechanisms** to immersive screens (Session View, Impersonation)
5. **Confirm before losing work** (Bundle Editor)

With these changes, users will always have at least two ways to return home:
- **Primary:** Back button / swipe gesture (step by step)
- **Secondary:** Tab bar tap (immediate jump to home)
- **Tertiary:** Home button (for deep screens)
