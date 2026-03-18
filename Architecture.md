# System Architecture

## Core Stack
- **Frontend Framework:** React Native / Expo (SDK 52)
- **Routing:** Expo Router (File-based routing)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Language:** TypeScript
- **Package Manager:** PNPM

## Backend & API
- **API Layer:** tRPC (End-to-end type-safe APIs)
- **Server Runtime:** Node.js (Express)
- **Real-time:** Custom WebSocket server with Supabase JWT verification
- **Bundler (Server):** esbuild

## Infrastructure & Data
- **Database:** Supabase (PostgreSQL)
  - Uses RPC functions for complex queries
  - Direct JS client usage (no heavy ORM)
- **Authentication:** Supabase Auth
  - Providers: Email/Password, Google OAuth
- **Storage:** Supabase Storage (for user uploads, bundle images)

## Integrations & Third-Party Services
- **AI / Inference:** OpenRouter (using Google Gemini 2.5 Flash as default)
- **Speech-to-Text:** Groq (Whisper-large-v3 model)
- **Social Media API:** Phyllo (for creator social stats and post attribution)
- **Payments:** Adyen (Drop-in / Native integration)
- **E-commerce:** Shopify (Storefront API for product catalog)
- **Calendar:** Google Calendar API (OAuth, Two-way sync)
- **Email:** Resend

## Key System Patterns
- **Role-Based Access:** App is divided into `(client)`, `(trainer)`, `(coordinator)`, and `(manager)` route groups.
- **Design System:** Centralized in `theme.config.js` and `design-system/` with strict ESLint enforcement against raw styling.
- **Dual-Path Sync:** Social data (Phyllo) syncs via webhooks for speed, backed by periodic polling/manual pulls to heal missed events.
- **MCP (Model Context Protocol):** Built-in server for AI assistant tool calling, with OpenClaw integration.