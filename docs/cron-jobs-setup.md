# Cron Jobs Setup for LocoMotivate

This guide explains how to set up automated scheduled tasks for LocoMotivate, including low inventory checks.

## Available Cron Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/health` | GET | Health check (no auth required) |
| `/api/cron/inventory-check` | POST | Run low inventory check |
| `/api/cron/run-all` | POST | Run all scheduled tasks |

## Authentication

All cron endpoints (except health check) require authentication using a secret key.

### Getting Your Cron Secret

The cron secret is automatically generated from your application's cookie secret. You can retrieve it by:

1. **From localhost:** Visit `/api/cron/secret` from the server itself
2. **From logs:** Check server startup logs for the cron secret

### Using the Secret

Include the secret in your cron requests using one of these methods:

**Query Parameter:**
```
POST /api/cron/inventory-check?key=YOUR_CRON_SECRET
```

**Authorization Header:**
```
POST /api/cron/inventory-check
Authorization: Bearer YOUR_CRON_SECRET
```

## Setting Up Scheduled Tasks

### Option 1: cron-job.org (Free)

1. Go to [cron-job.org](https://cron-job.org) and create an account
2. Create a new cron job:
   - **URL:** `https://YOUR_LOCOMOTIVATE_URL/api/cron/inventory-check?key=YOUR_SECRET`
   - **Method:** POST
   - **Schedule:** Daily at 9:00 AM (or your preferred time)
3. Save and enable the job

### Option 2: GitHub Actions

Create `.github/workflows/cron.yml`:

```yaml
name: Scheduled Tasks

on:
  schedule:
    # Run daily at 9:00 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  inventory-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run Inventory Check
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://YOUR_LOCOMOTIVATE_URL/api/cron/inventory-check"
```

Add `CRON_SECRET` to your repository secrets.

### Option 3: Vercel Cron (if using Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/inventory-check?key=YOUR_SECRET",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Option 4: Render.com Cron Jobs

1. Go to your Render dashboard
2. Create a new Cron Job
3. Set the command:
   ```bash
   curl -X POST "https://YOUR_LOCOMOTIVATE_URL/api/cron/inventory-check?key=YOUR_SECRET"
   ```
4. Set schedule: `0 9 * * *` (daily at 9 AM)

## Inventory Check Configuration

The inventory check endpoint accepts optional parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | number | 5 | Inventory level to trigger alert |
| `notify` | boolean | true | Whether to send notification |

**Example with custom threshold:**
```
POST /api/cron/inventory-check?key=SECRET&threshold=10&notify=true
```

## Response Format

### Success Response

```json
{
  "success": true,
  "checked": true,
  "bundlesWithLowInventory": 2,
  "notificationSent": true,
  "message": "Found 2 bundles with low inventory",
  "details": [
    {
      "bundleId": 123,
      "bundleTitle": "Starter Bundle",
      "lowProducts": [
        { "productName": "Protein Powder", "inventory": 3 }
      ]
    }
  ],
  "executedAt": "2024-01-15T09:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "Unauthorized"
}
```

## Notification Cooldown

To prevent notification spam, the system has a 1-hour cooldown between notifications. The cooldown is reset after each successful notification.

- First check: Notification sent
- Second check within 1 hour: Notification skipped
- Check after 1 hour: Notification sent again

## Monitoring

### Health Check

Use the health endpoint to verify the cron service is running:

```bash
curl https://YOUR_LOCOMOTIVATE_URL/api/cron/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T09:00:00.000Z",
  "service": "locomotivate-cron"
}
```

### Logging

All cron job executions are logged to the server console with the `[Cron]` prefix:

```
[Cron] Running inventory check with threshold=5, notify=true
[Cron] Inventory check complete: Found 2 bundles with low inventory
```

## Troubleshooting

**401 Unauthorized:**
- Verify your cron secret is correct
- Check that the secret is properly URL-encoded if using query parameter

**No notifications sent:**
- Check if cooldown period is active (1 hour between notifications)
- Verify notification service is configured
- Check server logs for notification errors

**Timeout errors:**
- Increase timeout in your cron service settings
- The inventory check may take longer with many bundles
