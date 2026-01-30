# LocoMotivate Deployment Guide

This guide provides step-by-step instructions for deploying LocoMotivate on your own server. The application consists of an Expo React Native frontend and a Node.js/Express backend with MySQL database.

---

## Prerequisites

Before starting, ensure your server has the following installed:

| Requirement | Minimum Version | Purpose |
|-------------|-----------------|---------|
| Node.js | 22.x | JavaScript runtime |
| pnpm | 9.12.0 | Package manager |
| MySQL | 8.0+ | Database |
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
# Database Configuration (Required)
DATABASE_URL="mysql://username:password@host:3306/database_name"

# Server Configuration
NODE_ENV=production
PORT=3000

# OAuth Configuration (Required for user authentication)
# These are provided by your OAuth provider
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret
OAUTH_REDIRECT_URI=https://your-domain.com/oauth/callback

# Session Secret (Required - generate a random 32+ character string)
SESSION_SECRET=your_random_session_secret_here

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
| `DATABASE_URL` | Yes | MySQL connection string |
| `NODE_ENV` | Yes | Set to `production` for deployment |
| `PORT` | No | Server port (default: 3000) |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `OAUTH_CLIENT_ID` | Yes* | OAuth provider client ID |
| `OAUTH_CLIENT_SECRET` | Yes* | OAuth provider client secret |
| `S3_BUCKET` | No | S3 bucket for file storage |

*Required if using user authentication

---

## Step 4: Set Up the Database

### 4.1 Create the MySQL Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE locomotivate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'locomotivate'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON locomotivate.* TO 'locomotivate'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4.2 Run Database Migrations

Generate and apply database migrations:

```bash
pnpm db:push
```

This command runs `drizzle-kit generate` followed by `drizzle-kit migrate` to create all necessary tables.

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
After=network.target mysql.service

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
| Database connection failed | Verify `DATABASE_URL` format and MySQL is running |
| Port already in use | Change `PORT` in `.env` or kill existing process |
| OAuth redirect error | Ensure `OAUTH_REDIRECT_URI` matches OAuth provider settings |
| Build errors | Run `pnpm check` to verify TypeScript types |
| Migration failed | Check database permissions and connection |

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

- [ ] `SESSION_SECRET` is a strong, unique random string
- [ ] Database credentials are not committed to version control
- [ ] SSL/TLS is configured for all external connections
- [ ] Database user has minimal required permissions
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
                    │         MySQL Database        │
                    │        (Drizzle ORM)          │
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
