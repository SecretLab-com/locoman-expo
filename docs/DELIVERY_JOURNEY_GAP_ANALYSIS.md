# Product Delivery Customer Journey - Gap Analysis

## Overview

This document compares the requirements from `BUNDLE_TO_DELIVERY_JOURNEY_UPDATE.md` and `PRODUCT_DELIVERY_JOURNEY.md` with the current Expo app implementation to identify gaps and missing features.

Last updated: March 2026

## Saved Cart / Custom Bundle Journey Status

### Data Model

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Dedicated proposal tables | Done | `saved_cart_proposals` + `saved_cart_proposal_items` in migration 023 |
| Proposal item types (bundle, product, custom_product, service) | Done | `saved_cart_item_type` enum |
| Invitation proposal link | Done | `invitations.saved_cart_proposal_id` + `proposal_snapshot_json` |
| Order proposal link + diff | Done | `orders.saved_cart_proposal_id` + `proposal_snapshot_json` + `cart_diff_json` |
| Order item enrichment | Done | `order_items.bundle_draft_id`, `custom_product_id`, `item_type`, `image_url`, `metadata` |

### Backend APIs

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Proposal CRUD | Done | `savedCartProposals.list/get/create/update` |
| Invite from proposal | Done | `savedCartProposals.sendInvite` |
| Checkout hydration | Done | `catalog.invitation` returns `invitationType` + `proposalSnapshot` |
| Finalize checkout with diff | Done | `orders.createFromProposal` with `diffProposalSnapshots` |
| Shopify handoff | Done | `submitPaidOrderToShopify` in `server/_core/index.ts` |

### Shared Logic

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Snapshot builder | Done | `shared/saved-cart-proposal.ts` `buildSavedCartProposalSnapshot` |
| Schedule projection | Done | `buildProjectedSchedule` from cadence + start date |
| Delivery projection | Done | `buildProjectedDeliveries` from items |
| Pricing calculation | Done | `calculateProposalPricing` |
| Proposal diff | Done | `diffProposalSnapshots` |

### Assistant Integration

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Search catalog products | Done | `search_catalog_products` tool in assistant + MCP |
| List custom products | Done | `list_custom_products` tool in assistant + MCP |
| Create proposal from NL | Done | `create_saved_cart_proposal` tool with preview/confirm |
| Send proposal invite | Done | `invite_client_to_saved_cart` tool with preview/confirm |
| List proposals | Done | `list_saved_cart_proposals` in MCP |

### Trainer Flow

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Trainer can shop in storefront | Done | `canPurchase` includes `isTrainer` in products screen |
| Cart supports custom_product + service | Done | `CartItem.type` includes `custom_product` and `service` |
| Cart has proposal context | Done | `proposalContext` with client, cadence, start date, time preference |
| Trainer proposal builder UI | Done | `TrainerProposalBuilder` in `app/(tabs)/cart.tsx` |
| Trainer nav entry to shop | Done | "Create Plan" and "Review & Send" in trainer More menu |
| Save proposal draft | Done | `savedCartProposals.create` / `savedCartProposals.update` |
| Send invite from proposal | Done | `savedCartProposals.sendInvite` |

### Customer Flow

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Saved-cart invite detected | Done | `invitationType === "saved_cart_proposal"` in invite screen |
| Route to editable checkout | Done | Invite screen routes to `/checkout?invitationToken=` |
| Customer can edit quantities | Done | `updateProposalItemQuantity` in checkout |
| Customer can remove base bundle | Done | `removeProposalItem` clears `baseBundleDraftId` |
| Recalculation after edits | Done | `buildSavedCartProposalSnapshot` in `proposalPreview` useMemo |
| Final cart becomes order source | Done | `orders.createFromProposal` uses customer-edited snapshot |

### Notifications and Fulfillment

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Cart diff persisted | Done | `orders.cart_diff_json` |
| Trainer push notification | Done | `notifyTrainerAboutPaidProposalOrder` with diff summary |
| Shopify order submission | Done | `submitPaidOrderToShopify` after payment |
| Shopify proposal ID tracking | Done | `note_attributes` includes `saved_cart_proposal_id` |

## Legacy Delivery Journey Status

### Phase 1: Order Placement

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Client purchases bundle with products | Done | Cart + Checkout + `orders.create` |
| Order confirmation | Done | Order confirmation screen |
| Products linked to trainer | Done | `bundleDrafts.productsJson` |
| Auto-create delivery records on order | Done | Both `orders.create` and `orders.createFromProposal` create deliveries |

### Phase 2: Trainer Notification

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Trainer receives order notification | Done | Push notification via `notifyBadgeCounts` |
| Dashboard shows pending deliveries | Done | `(trainer)/deliveries.tsx` with status tabs |

### Phase 3-6: Delivery Lifecycle

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Trainer marks ready / delivered | Done | `deliveries.markReady` / `deliveries.markDelivered` |
| Client confirms receipt | Done | `deliveries.confirmReceipt` |
| Client reports issue | Done | `deliveries.reportIssue` |
| Reschedule request/approve/reject | Done | `deliveries.requestReschedule/approveReschedule/rejectReschedule` |
| Multiple fulfillment methods | Done | `home_ship`, `trainer_delivery`, `vending`, `cafeteria` |

## Remaining Gaps

### Not Yet Implemented

| Area | Status | Notes |
|------|--------|-------|
| Trainer attribution / "My Store Link" | Not started | Documented in journey but no code exists for trainer-attributed independent shopping, commission tracking, or store link UI |
| Manager escalation workflow for disputes | Not started | Basic dispute view only, no escalation flow |
| Delivery analytics / reporting | Not started | No metrics or reporting surface |

### Low Priority

| Area | Status | Notes |
|------|--------|-------|
| Batch delivery actions | Not started | No bulk operations for deliveries |
| Dedicated trainer proposal review screen | Enhancement | Proposal builder works but lives inside the cart screen rather than a standalone route |
