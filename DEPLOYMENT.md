# LocoMotivate Deployment Guide

This guide provides step-by-step instructions for deploying LocoMotivate on your own server. The application consists of an Expo React Native frontend and a Node.js/Express backend backed by Supabase (PostgreSQL + Auth).

---

## Prerequisites

Before starting, ensure your server has the following installed:

| Requirement | Minimum Version | Purpose |
|-------------|-----------------|---------|
| Node.js | 22.x | JavaScript runtime |
| pnpm | 9.12.0 | Package manager |
| Supabase project | N/A | Database + authentication |
| Supabase CLI | Latest | Apply SQL migrations (optional but recommended) |
| Git | 2.x | Version control |

---

## Step 1: Clone the Repository

```bash
git clone <your-repo-url> locoman-expo
cd locoman-expo
```

---

## Step 2: Install Dependencies

Install all project dependencies using pnpm:

```bash
pnpm install
```

This will install both frontend (Expo/React Native) and backend (Express/tRPC) dependencies.

---

## Step 3: Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
NODE_ENV=production
PORT=3000

# Frontend Runtime Configuration (Required)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_BASE_URL=https://your-api-domain.com

# Optional native OAuth callback fallback
OAUTH_NATIVE_RETURN_TO=locomotivate://oauth/callback

# S3 Storage Configuration (Optional - for file uploads)
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# LLM Configuration (Optional - for AI features)
# Credentials are typically injected by the platform
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase key (secret) |
| `SUPABASE_ANON_KEY` | Recommended | Anon key for user-scoped server client usage |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase URL exposed to client apps |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key exposed to client apps |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Public backend base URL used by clients |
| `NODE_ENV` | Yes | Set to `production` for deployment |
| `PORT` | No | Server port (default: 3000) |
| `OAUTH_NATIVE_RETURN_TO` | No | Native app callback deep link |
| `S3_BUCKET` | No | S3 bucket for file storage |

---

## Step 4: Set Up the Database

### 4.1 Create and Configure Supabase Project

1. Create a Supabase project in the Supabase dashboard.
2. Copy project values into `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. (Recommended) install and login to Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 4.2 Apply Database Migrations

Apply the SQL migrations in `supabase/migrations/` to your Supabase project.

```bash
supabase db push
```

If you are not using the Supabase CLI, run each migration file in the Supabase SQL Editor in filename order.

---

## Step 5: Build the Application

Build the server for production:

```bash
pnpm build
```

This compiles the TypeScript server code to JavaScript in the `dist/` directory.

---

## Step 6: Start the Application

### Development Mode

For development with hot reloading:

```bash
pnpm dev
```

This starts both the Metro bundler (Expo) on port 8081 and the API server on port 3000.

### Production Mode

For production deployment:

```bash
# Start the API server
pnpm start

# In a separate terminal, start the Expo web server
npx expo start --web --port 8081
```

---

## Step 7: Configure Reverse Proxy (Recommended)

For production, use Nginx or another reverse proxy to handle SSL and routing.

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # tRPC routes
    location /trpc/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Expo web app
    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Step 8: Process Management (Recommended)

Use PM2 or systemd to keep the application running.

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the API server
pm2 start dist/index.js --name "locomotivate-api"

# Start the Expo web server
pm2 start "npx expo start --web --port 8081" --name "locomotivate-web"

# Save the process list
pm2 save

# Enable startup on boot
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/locomotivate-api.service`:

```ini
[Unit]
Description=LocoMotivate API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/locoman-expo
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable locomotivate-api
sudo systemctl start locomotivate-api
```

---

## Mobile App Deployment

### iOS (App Store)

1. Install EAS CLI: `npm install -g eas-cli`
2. Configure EAS: `eas build:configure`
3. Build for iOS: `eas build --platform ios`
4. Submit to App Store: `eas submit --platform ios`

### Android (Play Store)

1. Build for Android: `eas build --platform android`
2. Submit to Play Store: `eas submit --platform android`

### Development Testing

For testing on physical devices during development:

```bash
# Generate QR code for Expo Go
pnpm qr

# Or start with tunnel for external access
npx expo start --tunnel
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection failed | Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly |
| Port already in use | Change `PORT` in `.env` or kill existing process |
| OAuth redirect error | Ensure Supabase Auth redirect URLs include your web and native callback URLs |
| Build errors | Run `pnpm check` to verify TypeScript types |
| Migration failed | Confirm project is linked (`supabase link`) and rerun `supabase db push` |

### Useful Commands

```bash
# Check TypeScript errors
pnpm check

# Run tests
pnpm test

# Format code
pnpm format

# Lint code
pnpm lint
```

---

## Security Checklist

Before going to production, ensure:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is stored only in backend/server secrets
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` is anon-only (never service role)
- [ ] Supabase keys and URLs are not committed to version control
- [ ] SSL/TLS is configured for all external connections
- [ ] Supabase RLS policies are reviewed and tested
- [ ] Environment variables are properly secured
- [ ] Rate limiting is configured on the reverse proxy
- [ ] CORS is properly configured for your domain

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   iOS App       │   Android App   │      Web Browser        │
│  (Expo Go/      │  (Expo Go/      │    (Metro Bundler)      │
│   Native)       │   Native)       │                         │
└────────┬────────┴────────┬────────┴────────────┬────────────┘
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Nginx     │
                    │  (Reverse   │
                    │   Proxy)    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌──────▼──────┐
    │  Expo   │      │   API     │    │   tRPC      │
    │  Web    │      │  Server   │    │  Endpoints  │
    │ :8081   │      │  :3000    │    │             │
    └─────────┘      └─────┬─────┘    └──────┬──────┘
                           │                 │
                    ┌──────▼─────────────────▼──────┐
                    │     Supabase PostgreSQL DB    │
                    │      (SQL migrations)         │
                    └───────────────────────────────┘
```

---

## Support

For issues or questions:
- Check the `server/README.md` for backend-specific documentation
- Review the main `README.md` for frontend patterns
- Check `todo.md` for known issues and planned features

---

*Last updated: January 2026*
