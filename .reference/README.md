# LocoMotivate Reference Repository

This folder contains a cached copy of the original React implementation from:
https://github.com/SecretLab-com/locoman

## Purpose

Use this as a reference when implementing features in the Expo mobile app. The original codebase contains:

- **client/** - React frontend with Vite, shadcn/ui components
- **server/** - Express + tRPC backend
- **shared/** - Shared types and utilities
- **docs/** - Original documentation
- **drizzle/** - Database migrations

## Key Files to Reference

| Feature | Reference File |
|---------|---------------|
| Bundle Editor | `client/src/pages/BundleEditor.tsx` |
| Trainer Dashboard | `client/src/pages/TrainerDashboard.tsx` |
| Manager Approvals | `client/src/pages/ManagerApprovals.tsx` |
| Coordinator Impersonation | `client/src/pages/CoordinatorDashboard.tsx` |
| Client Home | `client/src/pages/ClientHome.tsx` |
| Shopify Integration | `server/shopify.ts` |
| tRPC Routers | `server/routers.ts` |

## Technology Differences

| Original (React) | Current (Expo) |
|-----------------|----------------|
| React 18 + Vite | React Native + Expo SDK 54 |
| React Router | Expo Router |
| shadcn/ui | NativeWind + Custom Components |
| Tanstack Query | Tanstack Query (same) |
| tRPC | tRPC (same) |

## Note

This folder is for reference only. Do not modify these files.
