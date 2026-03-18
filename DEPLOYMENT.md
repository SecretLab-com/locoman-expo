# Deployment & Operations

## Hosting Platforms
- **Mobile Apps (iOS/Android):** Expo Application Services (EAS)
  - Native builds via `eas build`
  - Over-The-Air (OTA) updates via `eas update`
- **Backend Server (tRPC/WebSockets):** Google Cloud Run
  - Containerized via Docker (`Dockerfile.backend`)
  - Serverless, auto-scaling
- **Web App:** Google Cloud Run
  - Containerized via Docker (`Dockerfile.web`) serving static Expo export via Nginx
- **Database & Auth:** Supabase (Managed Cloud)

## Required Subscriptions & Accounts
1. **Expo (EAS):** For CI/CD builds, OTA updates, and push notifications.
2. **Google Cloud Platform (GCP):** For Cloud Run hosting, Cloud Scheduler (cron jobs).
3. **Supabase:** Managed PostgreSQL, Auth, and Storage.
4. **OpenRouter:** API credits for LLM inference (Gemini 2.5 Flash).
5. **Groq:** API credits for fast Whisper transcription.
6. **Phyllo:** API access for creator social media integrations.
7. **Adyen:** Merchant account for payment processing and KYC.
8. **Shopify:** Storefront API access for product catalog.
9. **Resend:** Transactional email delivery.
10. **Apple Developer / Google Play Console:** App store distribution.

## CI/CD & Build Commands
- **Backend Deploy:** `pnpm run deploy:backend` (Builds Docker image, pushes to GCR, deploys to Cloud Run)
- **Web Deploy:** `pnpm run deploy:web` (Builds static web app, packages in Nginx Docker image, deploys to Cloud Run)
- **iOS Native Build:** `eas build --platform ios --auto-submit`
- **Android Native Build:** `eas build --platform android --auto-submit`
- **OTA Updates (Both platforms):** `eas update --channel production --message "Update description"`

## Environment Variables (Required for Production)
- `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Backend only)
- `EXPO_PUBLIC_API_BASE_URL` (Points to Cloud Run backend)
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `PHYLLO_CLIENT_ID` / `PHYLLO_CLIENT_SECRET`
- `ADYEN_API_KEY` / `ADYEN_MERCHANT_ACCOUNT`
- `SHOPIFY_STORE_DOMAIN` / `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- `RESEND_API_KEY`

## Scheduled Jobs (Cron)
- **Phyllo Periodic Sync:** Configured via Google Cloud Scheduler to hit `/api/internal/phyllo/periodic-sync` on the backend Cloud Run instance to backfill social stats.