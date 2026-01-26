# LocoMotivate Migration Plan

> **Source:** React implementation at https://github.com/SecretLab-com/locoman
> **Target:** Expo SDK 54 / React Native mobile app

## Executive Summary

This document analyzes the gaps between the original React web application and the current Expo mobile implementation, providing a prioritized migration plan.

---

## Gap Analysis

### Server/API Layer

| Router Namespace | Original | Expo | Status | Priority |
|-----------------|----------|------|--------|----------|
| auth | ✅ | ✅ | Complete | - |
| impersonate | ✅ | ✅ (coordinator) | Complete | - |
| templates | ✅ | ❌ | **Missing** | High |
| bundles | ✅ | ✅ | Complete | - |
| commission | ✅ | ❌ | **Missing** | Medium |
| userProfile | ✅ | ✅ (profile) | Complete | - |
| publicProfile | ✅ | ❌ | **Missing** | Medium |
| catalog | ✅ | ✅ | Complete | - |
| products | ✅ | ❌ | **Missing** | High |
| clients | ✅ | ✅ | Complete | - |
| subscriptions | ✅ | ✅ | Complete | - |
| sessions | ✅ | ✅ | Complete | - |
| orders | ✅ | ✅ | Complete | - |
| messages | ✅ | ✅ | Complete | - |
| calendar | ✅ | ✅ | Complete | - |
| trainers | ✅ | ❌ | **Missing** | High |
| stats | ✅ | ✅ (trainerDashboard) | Complete | - |
| bundlesManagement | ✅ | ❌ | **Missing** | Medium |
| activity | ✅ | ❌ | **Missing** | Low |
| invitations | ✅ | ❌ | **Missing** | High |
| trainerProfile | ✅ | ❌ | **Missing** | Medium |
| bundleApproval | ✅ | ❌ | **Missing** | High |
| joinRequests | ✅ | ❌ | **Missing** | High |
| admin | ✅ | ✅ | Partial | Medium |
| recommendations | ✅ | ❌ | **Missing** | Low |
| shopify | ✅ | ✅ | Complete | - |
| earnings | ✅ | ✅ | Complete | - |
| ads | ✅ | ❌ | **Missing** | Low |
| businessSignup | ✅ | ❌ | **Missing** | Low |
| clientSpending | ✅ | ❌ | **Missing** | Medium |
| deliveries | ❌ | ✅ | Expo-only | - |
| ai | ❌ | ✅ | Expo-only | - |

**Original routers.ts:** 5,010 lines
**Current routers.ts:** 916 lines
**Gap:** ~4,100 lines of API logic

---

### Database Schema

| Table | Original | Expo | Status | Priority |
|-------|----------|------|--------|----------|
| users | ✅ | ✅ | Complete | - |
| trainerMedia | ✅ | ❌ | **Missing** | Medium |
| revokedSessions | ✅ | ❌ | **Missing** | Low |
| shops | ✅ | ❌ | **Missing** | Low |
| bundleTemplates | ✅ | ✅ | Complete | - |
| bundleDrafts | ✅ | ✅ | Complete | - |
| bundlePublications | ✅ | ❌ | **Missing** | High |
| products | ✅ | ✅ | Complete | - |
| clients | ✅ | ✅ | Complete | - |
| subscriptions | ✅ | ✅ | Complete | - |
| sessions | ✅ | ✅ | Complete | - |
| orders | ✅ | ✅ | Complete | - |
| orderItems | ✅ | ✅ | Complete | - |
| messages | ✅ | ✅ | Complete | - |
| calendarEvents | ✅ | ✅ | Complete | - |
| predictivePrompts | ✅ | ❌ | **Missing** | Low |
| trainerApprovals | ✅ | ❌ | **Missing** | Medium |
| bundleReviews | ✅ | ❌ | **Missing** | High |
| activityLogs | ✅ | ✅ | Complete | - |
| recommendations | ✅ | ❌ | **Missing** | Low |
| calendarConnections | ✅ | ❌ | **Missing** | Low |
| joinRequests | ✅ | ❌ | **Missing** | High |
| invitations | ✅ | ✅ | Complete | - |
| impersonationLogs | ✅ | ❌ | **Missing** | Low |
| impersonationShortcuts | ✅ | ❌ | **Missing** | Low |
| tagColors | ✅ | ❌ | **Missing** | Low |
| productSPF | ✅ | ❌ | **Missing** | Low |
| platformSettings | ✅ | ❌ | **Missing** | Low |
| serviceDeliveries | ✅ | ❌ | **Missing** | Medium |
| trainerEarnings | ✅ | ✅ | Complete | - |
| localBusinesses | ✅ | ❌ | **Missing** | Low |
| adPartnerships | ✅ | ❌ | **Missing** | Low |
| adPlacements | ✅ | ❌ | **Missing** | Low |
| adEarnings | ✅ | ❌ | **Missing** | Low |
| orderLineItems | ✅ | ❌ | **Missing** | Medium |
| trainerPoints | ✅ | ❌ | **Missing** | Medium |
| pointTransactions | ✅ | ❌ | **Missing** | Medium |
| trainerAwards | ✅ | ❌ | **Missing** | Low |
| productDeliveries | ✅ | ✅ | Complete | - |
| bundleInvitations | ✅ | ❌ | **Missing** | High |

**Original tables:** 40
**Current tables:** 15
**Gap:** 25 tables

---

### Pages/Screens

| Page | Original | Expo | Status | Priority |
|------|----------|------|--------|----------|
| **Public** | | | | |
| Home | ✅ | ✅ | Complete | - |
| Login | ✅ | ✅ | Complete | - |
| Register | ✅ | ✅ | Complete | - |
| TrainerDirectory | ✅ | ✅ | Complete | - |
| TrainerLanding | ✅ | ✅ (trainer/[id]) | Complete | - |
| InviteAccept | ✅ | ✅ (invite/[token]) | Complete | - |
| PublicProfile | ✅ | ❌ | **Missing** | Medium |
| BusinessSignup | ✅ | ❌ | **Missing** | Low |
| **Shopper** | | | | |
| Catalog | ✅ | ✅ | Complete | - |
| BundleDetail | ✅ | ✅ | Complete | - |
| Cart | ✅ | ✅ | Complete | - |
| Products | ✅ | ✅ | Complete | - |
| **Client** | | | | |
| ClientHome | ✅ | ✅ | Complete | - |
| ClientOrders | ✅ | ✅ | Complete | - |
| ClientDeliveries | ✅ | ✅ | Complete | - |
| ClientSubscriptions | ✅ | ✅ | Complete | - |
| ClientSpending | ✅ | ✅ | Complete | - |
| **Trainer** | | | | |
| TrainerDashboard | ✅ | ✅ | Complete | - |
| TrainerBundles | ✅ | ✅ | Complete | - |
| BundleEditor | ✅ | ✅ | Complete | - |
| TrainerClients | ✅ | ✅ | Complete | - |
| ClientDetail | ✅ | ✅ | Complete | - |
| TrainerOrders | ✅ | ✅ | Complete | - |
| TrainerDeliveries | ✅ | ✅ | Complete | - |
| TrainerEarnings | ✅ | ✅ | Complete | - |
| TrainerCalendar | ✅ | ✅ | Complete | - |
| TrainerMessages | ✅ | ✅ | Complete | - |
| TrainerSettings | ✅ | ✅ | Complete | - |
| TrainerPoints | ✅ | ✅ | Complete | - |
| AdPartnerships | ✅ | ✅ | Complete | - |
| ImageAnalytics | ✅ | ❌ | **Missing** | Low |
| **Manager** | | | | |
| ManagerDashboard | ✅ | ✅ | Complete | - |
| ManagerTrainers | ✅ | ✅ | Complete | - |
| TrainerDetail | ✅ | ❌ | **Missing** | Medium |
| ManagerTemplates | ✅ | ✅ | Complete | - |
| TemplateEditor | ✅ | ❌ | **Missing** | High |
| ManagerProducts | ✅ | ✅ | Complete | - |
| BundleApprovals | ✅ | ✅ | Complete | - |
| BundleDetail | ✅ | ❌ | **Missing** | Medium |
| ManagerUsers | ✅ | ✅ | Complete | - |
| ManagerAnalytics | ✅ | ✅ | Complete | - |
| ManagerDeliveries | ✅ | ✅ | Complete | - |
| ManagerInvitations | ✅ | ✅ | Complete | - |
| ManagerSettings | ✅ | ❌ | **Missing** | Low |
| AdApprovals | ✅ | ❌ | **Missing** | Low |
| BundlePerformance | ✅ | ❌ | **Missing** | Low |
| Bundles (all) | ✅ | ❌ | **Missing** | Medium |
| SPFManagement | ✅ | ❌ | **Missing** | Low |
| TagManagement | ✅ | ❌ | **Missing** | Low |
| **Coordinator** | | | | |
| Impersonate | ✅ | ✅ | Complete | - |
| ImpersonationLogs | ✅ | ✅ | Complete | - |

**Original pages:** 56
**Current pages:** 45
**Gap:** 11 pages

---

### Components

| Component | Original | Expo | Status | Priority |
|-----------|----------|------|--------|----------|
| AIChatBox | ✅ | ❌ | **Missing** | Low |
| AdSidebar | ✅ | ❌ | **Missing** | Low |
| AvatarUpload | ✅ | ❌ | **Missing** | Medium |
| BulkInviteDialog | ✅ | ❌ | **Missing** | Medium |
| ImageCropper | ✅ | ❌ | **Missing** | Medium |
| ImageGuidelines | ✅ | ❌ | **Missing** | Low |
| ImageLibraryDialog | ✅ | ❌ | **Missing** | Medium |
| ImageViewer | ✅ | ❌ | **Missing** | Low |
| ImpersonationBanner | ✅ | ✅ | Complete | - |
| InvitationAnalytics | ✅ | ❌ | **Missing** | Low |
| InviteBundleDialog | ✅ | ❌ | **Missing** | High |
| InviteToBundleDialog | ✅ | ❌ | **Missing** | High |
| Map | ✅ | ❌ | **Missing** | Low |
| ProductDetailSheet | ✅ | ❌ | **Missing** | Medium |
| TagInput | ✅ | ❌ | **Missing** | Low |
| TrainerMediaGallery | ✅ | ❌ | **Missing** | Medium |

---

## Migration Priority

### Phase 1: Critical API Routes (High Priority)

These routes are essential for core functionality:

1. **templates router** - Template CRUD for managers
2. **trainers router** - Trainer directory and profile management
3. **invitations router** - Client invitation system
4. **bundleApproval router** - Bundle review workflow
5. **joinRequests router** - Client join request handling
6. **products router** - Product catalog management

### Phase 2: Database Schema (High Priority)

Add missing tables:

1. **bundlePublications** - Track Shopify-published bundles
2. **bundleReviews** - Manager review comments
3. **joinRequests** - Client-initiated trainer requests
4. **bundleInvitations** - Bundle-specific invitations

### Phase 3: Missing Pages (Medium Priority)

1. **TemplateEditor** - Manager template creation/editing
2. **TrainerDetail** - Manager view of trainer performance
3. **BundleDetail** - Manager view of bundle details
4. **PublicProfile** - User public profile page

### Phase 4: Components (Medium Priority)

1. **InviteBundleDialog** - Invite client to bundle
2. **InviteToBundleDialog** - Suggest bundle to client
3. **AvatarUpload** - Profile image upload
4. **ImageLibraryDialog** - Trainer media library
5. **ProductDetailSheet** - Product detail modal

### Phase 5: Low Priority Features

1. Ad partnerships system
2. Business signup flow
3. SPF management
4. Tag management
5. Predictive prompts
6. Calendar connections

---

## Implementation Order

### Sprint 1: Core API Routes
- [ ] Migrate templates router (CRUD operations)
- [ ] Migrate trainers router (directory, approval)
- [ ] Migrate invitations router (send, accept, revoke)
- [ ] Migrate joinRequests router (create, approve, reject)
- [ ] Migrate bundleApproval router (approve, reject, request changes)

### Sprint 2: Database Schema
- [ ] Add bundlePublications table
- [ ] Add bundleReviews table
- [ ] Add joinRequests table
- [ ] Add bundleInvitations table
- [ ] Add trainerMedia table
- [ ] Run migrations

### Sprint 3: Manager Features
- [ ] Create TemplateEditor screen
- [ ] Create TrainerDetail screen
- [ ] Create BundleDetail (manager view) screen
- [ ] Add bundle performance metrics

### Sprint 4: Invitation System
- [ ] Create InviteBundleDialog component
- [ ] Create InviteToBundleDialog component
- [ ] Implement bulk invite feature
- [ ] Add invitation analytics

### Sprint 5: Media & Profile
- [ ] Create AvatarUpload component
- [ ] Create ImageLibraryDialog component
- [ ] Create TrainerMediaGallery component
- [ ] Create PublicProfile page

---

## Estimated Effort

| Category | Lines of Code | Estimated Hours |
|----------|--------------|-----------------|
| API Routes | ~4,100 | 40-60 |
| Database Schema | ~500 | 8-12 |
| Pages/Screens | ~2,000 | 20-30 |
| Components | ~1,500 | 15-20 |
| **Total** | **~8,100** | **83-122** |

---

## Recommendations

1. **Start with API routes** - The server layer is the foundation; UI can't work without it
2. **Batch database migrations** - Add all missing tables in one migration to avoid multiple schema changes
3. **Reuse original logic** - Copy business logic from `.reference/` and adapt for Expo
4. **Test incrementally** - Add tests for each migrated feature before moving on
5. **Maintain feature parity** - Ensure mobile UX matches web where appropriate

---

## Next Steps

Begin with Sprint 1: Core API Routes, starting with the `templates` router since it's required for the "Create from Template" feature identified in the customer journey gap analysis.
