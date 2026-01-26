# LocoMotivate Expo Migration Inventory

## Overview
This document tracks the migration from React web app to Expo (React Native) for cross-platform support.

## Technology Stack

### Current (React Web)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui components
- wouter (routing)
- tRPC 11 (API)
- Chart.js (charts)
- Google Maps

### Target (Expo)
- Expo SDK 52+ with TypeScript
- Tamagui (UI components + styling)
- Expo Router (file-based routing)
- tRPC 11 (API - same backend)
- Victory Native (charts)
- react-native-maps (maps)
- expo-secure-store (auth tokens)

---

## Pages Inventory (54 total)

### Root Pages (11)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Home/Landing | Home.tsx | High | Medium |
| Login | Login.tsx | High | Low |
| Profile | Profile.tsx | Medium | Medium |
| Public Profile | PublicProfile.tsx | Low | Medium |
| Trainer Directory | TrainerDirectory.tsx | Medium | Medium |
| Trainer Landing | TrainerLanding.tsx | Medium | Medium |
| Business Signup | BusinessSignup.tsx | Low | Medium |
| Invite | Invite.tsx | Low | Low |
| Invite Accept | InviteAccept.tsx | Low | Low |
| Not Found | NotFound.tsx | Low | Low |
| Component Showcase | ComponentShowcase.tsx | Low | High |

### Manager Pages (18)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Dashboard | manager/Dashboard.tsx | High | Medium |
| Analytics | manager/Analytics.tsx | High | High (charts) |
| Settings | manager/Settings.tsx | High | High |
| Users | manager/Users.tsx | High | Medium |
| Trainers | manager/Trainers.tsx | High | Medium |
| Trainer Detail | manager/TrainerDetail.tsx | Medium | Medium |
| Bundles | manager/Bundles.tsx | High | Medium |
| Bundle Detail | manager/BundleDetail.tsx | High | Medium |
| Bundle Approvals | manager/BundleApprovals.tsx | High | Medium |
| Bundle Performance | manager/BundlePerformance.tsx | Medium | High (charts) |
| Deliveries | manager/Deliveries.tsx | Medium | Medium |
| Products | manager/Products.tsx | Medium | Medium |
| Templates | manager/Templates.tsx | Low | Medium |
| Template Editor | manager/TemplateEditor.tsx | Low | High |
| Tag Management | manager/TagManagement.tsx | Low | Low |
| SPF Management | manager/SPFManagement.tsx | Low | Medium |
| Invitations | manager/Invitations.tsx | Low | Medium |
| Ad Approvals | manager/AdApprovals.tsx | Low | Medium |

### Trainer Pages (14)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Dashboard | trainer/Dashboard.tsx | High | Medium |
| Bundles | trainer/Bundles.tsx | High | Medium |
| Bundle Editor | trainer/BundleEditor.tsx | High | Very High |
| Earnings | trainer/Earnings.tsx | High | High (charts) |
| Clients | trainer/Clients.tsx | Medium | Medium |
| Client Detail | trainer/ClientDetail.tsx | Medium | Medium |
| Orders | trainer/Orders.tsx | Medium | Medium |
| Deliveries | trainer/Deliveries.tsx | Medium | Medium |
| Calendar | trainer/Calendar.tsx | Medium | High |
| Messages | trainer/Messages.tsx | Medium | High |
| Settings | trainer/Settings.tsx | Medium | Medium |
| Points | trainer/Points.tsx | Low | Medium |
| Image Analytics | trainer/ImageAnalytics.tsx | Low | Medium |
| Ad Partnerships | trainer/AdPartnerships.tsx | Low | Medium |

### Client Pages (5)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Home | client/Home.tsx | High | Medium |
| Orders | client/Orders.tsx | High | Medium |
| Deliveries | client/Deliveries.tsx | Medium | Medium |
| Subscriptions | client/Subscriptions.tsx | Medium | Medium |
| Spending | client/Spending.tsx | Low | Medium |

### Shopper Pages (4)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Catalog | shopper/Catalog.tsx | High | Medium |
| Bundle Detail | shopper/BundleDetail.tsx | High | Medium |
| Cart | shopper/Cart.tsx | High | Medium |
| Products | shopper/Products.tsx | Medium | Medium |

### Dev Pages (2)
| Page | File | Priority | Complexity |
|------|------|----------|------------|
| Impersonate | dev/Impersonate.tsx | Low | Medium |
| Impersonation Exit | dev/ImpersonationExitTransition.tsx | Low | Low |

---

## Components Inventory (81 total)

### Custom Components (28)
| Component | Complexity | Notes |
|-----------|------------|-------|
| AIChatBox | High | Chat interface, streaming |
| AdSidebar | Medium | Ads display |
| AppShell | High | Main layout wrapper |
| AvatarUpload | High | Image upload/crop |
| BottomTabNav | Medium | Navigation |
| Breadcrumb | Low | Navigation |
| BulkInviteDialog | Medium | Form dialog |
| DashboardLayout | High | Layout with sidebar |
| ErrorBoundary | Low | Error handling |
| ImageCropper | High | Image manipulation |
| ImageLibraryDialog | Medium | Image picker |
| ImageViewer | Medium | Image display |
| ImpersonationBanner | Low | Banner |
| InvitationAnalytics | Medium | Charts |
| InviteBundleDialog | Medium | Form dialog |
| InviteToBundleDialog | Medium | Form dialog |
| ManusDialog | Medium | Custom dialog |
| Map | High | Google Maps |
| ProductDetailSheet | Medium | Bottom sheet |
| PullToRefresh | Medium | Mobile gesture |
| RefreshableList | Medium | List with refresh |
| SwipeableListItem | Medium | Swipe gestures |
| TagInput | Medium | Tag input |
| TopHeader | Medium | Header |
| TrainerMediaGallery | Medium | Image gallery |
| skeletons | Low | Loading states |

### UI Components (shadcn/ui - 53)
All need Tamagui equivalents or custom implementation.

---

## Third-Party Libraries Replacement

| Current | Expo Replacement |
|---------|------------------|
| wouter | expo-router |
| tailwindcss | tamagui |
| shadcn/ui | tamagui + custom |
| chart.js | victory-native |
| @googlemaps/js-api-loader | react-native-maps |
| lucide-react | lucide-react-native |
| date-fns | date-fns (same) |
| sonner | burnt (toast) |
| cmdk | custom command palette |
| vaul | @gorhom/bottom-sheet |
| embla-carousel | react-native-reanimated-carousel |

---

## Migration Order

### Phase 1: Foundation
1. Create Expo project
2. Configure Tamagui
3. Set up Expo Router
4. Configure tRPC client
5. Set up auth context

### Phase 2: Core UI Components
1. Button, Card, Input, Select
2. Dialog, Sheet, Tabs
3. Avatar, Badge, Skeleton
4. Toast, Alert

### Phase 3: High Priority Pages
1. Login
2. Manager Dashboard
3. Trainer Dashboard
4. Shopper Catalog
5. Cart

### Phase 4: Medium Priority Pages
1. All Manager pages
2. All Trainer pages
3. Client pages

### Phase 5: Low Priority & Polish
1. Dev pages
2. Charts migration
3. Maps migration
4. Platform-specific optimizations

---

## Estimated Effort

| Phase | Estimated Time |
|-------|---------------|
| Foundation | 2-3 hours |
| Core UI | 4-6 hours |
| High Priority Pages | 6-8 hours |
| Medium Priority Pages | 8-12 hours |
| Low Priority & Polish | 4-6 hours |
| **Total** | **24-35 hours** |

---

## Notes

- Backend (server/) remains unchanged - only client migration
- tRPC integration should work with minimal changes
- Focus on web first, then mobile-specific adjustments
- Some features may need platform-specific implementations
