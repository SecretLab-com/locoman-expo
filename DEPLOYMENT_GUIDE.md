# LocoMotivate Deployment Guide

This guide outlines the processes for deploying the backend, web frontend, and native mobile## 1. Quick Start: Shorthand Commands

We have added convenience scripts to `package.json` to simplify the deployment of all components.

| Command | Action |
|---------|--------|
| `pnpm run deploy:full` | Deploy both Backend and Web to Cloud Run |
| `pnpm run deploy:backend` | Build and deploy Backend to Cloud Run |
| `pnpm run deploy:web` | Build and deploy Web to Cloud Run |
| `pnpm run deploy:ios` | Trigger a native iOS build and submit to TestFlight |
| `pnpm run deploy:android` | Trigger a native Android build and submit to Play Store |
| `pnpm run deploy:ota` | Push an OTA update to all platforms (Production) |
| `pnpm run deploy:ios:ota` | Push an OTA update specifically for iOS |
| `pnpm run deploy:android:ota` | Push an OTA update specifically for Android |

---

## 2. Backend & Web (Google Cloud Run)

The backend and web frontend are containerized and deployed to Google Cloud Run. You can use the `pnpm run deploy:backend` and `pnpm run deploy:web` commands mentioned above, or run the manual steps below.

### Prerequisites
- Google Cloud CLI installed and authenticated.
- Docker installed and running.

### Deploying the Backend
The backend serves the tRPC API and manages database connections.

```bash
# Build the backend image for amd64 architecture
docker build --platform linux/amd64 -f Dockerfile.backend -t gcr.io/[PROJECT_ID]/locoman-backend .

# Push to Google Container Registry
docker push gcr.io/[PROJECT_ID]/locoman-backend

# Deploy to Cloud Run
gcloud run deploy locoman-backend \
  --image gcr.io/[PROJECT_ID]/locoman-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Phyllo periodic sync on the deployed backend

Use Cloud Scheduler as the reliable production trigger for the Phyllo pull sync.

Exact deployed values from this repo:

- Project: `locoman-486301`
- Region: `us-central1`
- Cloud Run service: `locoman-backend`
- Public backend URL: `https://locoman-backend-870100645593.us-central1.run.app`
- Custom domain: `https://services.bright.coach`
- Periodic sync endpoint: `https://locoman-backend-870100645593.us-central1.run.app/api/internal/phyllo/periodic-sync`
- Suggested scheduler job name: `locoman-phyllo-periodic-sync`

Recommended production setup:

- Keep `PHYLLO_AUTH_BASIC` and `PHYLLO_WEBHOOK_SECRET` set as they are now.
- Set `PHYLLO_PERIODIC_SYNC_KEY` to a strong random secret.
- Set `PHYLLO_PERIODIC_SYNC_MS='0'` on Cloud Run so you rely on Cloud Scheduler instead of in-process timers.
- Set `PHYLLO_PERIODIC_SYNC_BATCH_SIZE='250'` unless you want a smaller scan size.

Generate a secret locally:

```bash
export PHYLLO_PERIODIC_SYNC_KEY="$(openssl rand -hex 32)"
```

Update the deployed backend env vars:

```bash
gcloud run services update 'locoman-backend' \
  --project 'locoman-486301' \
  --region 'us-central1' \
  --update-env-vars "PHYLLO_PERIODIC_SYNC_KEY=${PHYLLO_PERIODIC_SYNC_KEY},PHYLLO_PERIODIC_SYNC_MS=0,PHYLLO_PERIODIC_SYNC_BATCH_SIZE=250"
```

Create the scheduler job:

```bash
gcloud scheduler jobs create http 'locoman-phyllo-periodic-sync' \
  --project 'locoman-486301' \
  --location 'us-central1' \
  --schedule '*/15 * * * *' \
  --time-zone 'Etc/UTC' \
  --http-method 'POST' \
  --uri 'https://locoman-backend-870100645593.us-central1.run.app/api/internal/phyllo/periodic-sync' \
  --headers "Content-Type=application/json,X-LOCO-CRON-KEY=${PHYLLO_PERIODIC_SYNC_KEY}" \
  --message-body '{}'
```

If the job already exists, update it instead:

```bash
gcloud scheduler jobs update http 'locoman-phyllo-periodic-sync' \
  --project 'locoman-486301' \
  --location 'us-central1' \
  --schedule '*/15 * * * *' \
  --time-zone 'Etc/UTC' \
  --http-method 'POST' \
  --uri 'https://locoman-backend-870100645593.us-central1.run.app/api/internal/phyllo/periodic-sync' \
  --headers "Content-Type=application/json,X-LOCO-CRON-KEY=${PHYLLO_PERIODIC_SYNC_KEY}" \
  --message-body '{}'
```

Manual verification:

```bash
curl -X POST 'https://locoman-backend-870100645593.us-central1.run.app/api/internal/phyllo/periodic-sync' \
  -H 'Content-Type: application/json' \
  -H "X-LOCO-CRON-KEY: ${PHYLLO_PERIODIC_SYNC_KEY}" \
  -d '{}'
```

Expected behavior:

- `200` means the sync ran.
- `202` means the endpoint accepted the call but skipped work, usually because a sync was already running.
- Any `401` means the scheduler key does not match `PHYLLO_PERIODIC_SYNC_KEY`.
- Any `500` usually means required backend config such as `PHYLLO_AUTH_BASIC` is missing or invalid.

### Deploying the Web Frontend
The web app is exported as a static site and served via Nginx.

```bash
# Build the web image
docker build --platform linux/amd64 -f Dockerfile.web -t gcr.io/[PROJECT_ID]/locoman-web .

# Push to Google Container Registry
docker push gcr.io/[PROJECT_ID]/locoman-web

# Deploy to Cloud Run
gcloud run deploy locoman-web \
  --image gcr.io/[PROJECT_ID]/locoman-web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 3. Native Mobile Apps (EAS Build)

We use Expo Application Services (EAS) to build native binaries for iOS (IPA) and Android (AAB/APK). The shorthand commands (`pnpm run deploy:ios` and `pnpm run deploy:android`) are configured with the `--auto-submit` flag, which automatically uploads the build to TestFlight or the Google Play Store once complete.

### Prerequisites
- EAS CLI installed (`npm install -g eas-cli`).
- Authenticated with Expo (`eas login`).

### Creating a New Binary
Run these commands when you make changes to the native configuration (`app.config.ts`, `app.json`, or native dependencies).

```bash
# Build for iOS (TestFlight/Production)
eas build --platform ios

# Build for Android (Play Store/Production)
eas build --platform android

# Build all platforms
eas build --platform all
```

---

## 4. Over-The-Air (OTA) Updates (EAS Update)

OTA updates allow you to push JavaScript and asset changes instantly without a full native build or app store review. Use `pnpm run deploy:ota`.

### When to use OTA
- General UI changes.
- Bug fixes in logic or components.
- Adding new features that don't require new native modules.

### Pushing an Update
We have configured release channels linked to build profiles.

```bash
# Push an update to the production channel
eas update --channel production --message "Fixed keyboard overlap and streamlined info flow"

# Check status of recent updates
eas update:view
```

### Update Policy
- Our apps are configured to check for updates **on launch**.
- If an update is available, it will be downloaded and applied on the next restart.

---

## 4. Environment Variables

Ensure the following variables are correctly set in the environment or `.env` file before building:

| Variable | Description | Platform |
|----------|-------------|----------|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL for the backend API | All |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL for client apps | All |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for client apps | All |
| `SUPABASE_URL` | Supabase project URL for backend | Backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) | Backend |
| `PHYLLO_AUTH_BASIC` | Server-side basic auth for direct Phyllo API pulls | Backend |
| `PHYLLO_WEBHOOK_SECRET` | Verifies incoming Phyllo webhooks | Backend |
| `PHYLLO_PERIODIC_SYNC_KEY` | Shared secret required by `/api/internal/phyllo/periodic-sync` | Backend |
| `PHYLLO_PERIODIC_SYNC_MS` | Set to `0` on Cloud Run when using Cloud Scheduler as the trigger | Backend |
| `PHYLLO_PERIODIC_SYNC_BATCH_SIZE` | Max connected Phyllo profiles scanned per scheduler run | Backend |
