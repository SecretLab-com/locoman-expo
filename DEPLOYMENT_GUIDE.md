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
