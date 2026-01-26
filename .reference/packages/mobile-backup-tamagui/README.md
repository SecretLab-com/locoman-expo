# LocoMotivate - Expo Mobile App

A cross-platform mobile application for the LocoMotivate fitness trainer/client management platform, built with Expo and React Native.

## Overview

LocoMotivate is a trainer-powered wellness platform that connects fitness trainers with clients through curated product bundles. This Expo app provides native mobile experiences for iOS, Android, and web platforms.

## Tech Stack

- **Framework**: Expo SDK 52 with Expo Router v4
- **UI Library**: Tamagui (React Native + Web universal components)
- **State Management**: TanStack Query (React Query)
- **API Layer**: tRPC client (connects to existing Express backend)
- **Authentication**: Manus OAuth with secure token storage
- **Navigation**: Expo Router (file-based routing)
- **Icons**: Lucide React Native via @tamagui/lucide-icons

## Project Structure

```
locomotivate-expo/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── manager/              # Manager dashboard pages
│   │   ├── trainer/              # Trainer portal pages
│   │   ├── client/               # Client/shopper pages
│   │   ├── shop/                 # Shop/browse pages
│   │   └── profile/              # Profile/settings pages
│   ├── shop/bundles/[id].tsx     # Bundle detail page
│   ├── cart.tsx                  # Shopping cart
│   ├── login.tsx                 # Login screen
│   └── _layout.tsx               # Root layout with providers
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Dialog.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   └── ...more
│   └── layout/                   # Layout components
│       └── AppShell.tsx
├── contexts/
│   └── AuthContext.tsx           # Authentication context
├── lib/
│   └── trpc.ts                   # tRPC client configuration
├── tamagui.config.ts             # Tamagui theme configuration
├── app.json                      # Expo configuration
└── package.json
```

## Features

### User Roles

1. **Manager/Coordinator**
   - Dashboard with platform analytics
   - Trainer application approvals
   - Bundle submission reviews
   - User management
   - Shopify sync settings

2. **Trainer**
   - Personal dashboard with stats
   - Client management
   - Bundle creation and management
   - Schedule/session management
   - Earnings tracking

3. **Client/Shopper**
   - Browse and purchase bundles
   - Active subscription management
   - Progress tracking
   - Wishlist and favorites
   - Shopping cart and checkout

### Core Components

- **Bottom Tab Navigation**: Role-based tab navigation with dynamic tabs based on user role
- **Pull-to-Refresh**: All list views support pull-to-refresh
- **Responsive Design**: Adapts to phone and tablet layouts
- **Dark/Light Theme**: System theme detection with manual override
- **Secure Storage**: Tokens stored securely using expo-secure-store

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android

# Run on web
pnpm web
```

### Environment Configuration

Create a `.env` file or configure in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-api-url.com",
      "appId": "your-manus-app-id",
      "oauthPortalUrl": "https://auth.manus.im"
    }
  }
}
```

## UI Components

The app includes a comprehensive set of UI components built with Tamagui:

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, outline, ghost, destructive variants |
| `Card` | Container with header, content, footer sections |
| `Input` | Text input with label, error, and icon support |
| `Select` | Dropdown select with native picker |
| `Dialog` | Modal dialogs with responsive bottom sheet on mobile |
| `Badge` | Status badges with semantic colors |
| `Avatar` | User avatars with fallback initials |
| `Tabs` | Tab navigation with pills and underline variants |
| `Toast` | Toast notifications for feedback |
| `Skeleton` | Loading skeletons for content placeholders |
| `EmptyState` | Empty state illustrations |

## API Integration

The app uses tRPC for type-safe API calls:

```typescript
// Query example
const { data, isLoading } = trpc.trainer.getClients.useQuery({
  status: 'active',
});

// Mutation example
const createBundle = trpc.trainer.createBundle.useMutation({
  onSuccess: () => {
    toast.success('Bundle created');
  },
});
```

## Authentication

Authentication is handled through Manus OAuth:

```typescript
const { user, login, logout, isAuthenticated } = useAuth();

// Login triggers OAuth flow
await login();

// Check role
if (user?.role === 'trainer') {
  // Show trainer features
}
```

## Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for web
pnpm build:web
```

## Connecting to Backend

This app connects to the existing LocoMotivate Express backend. Ensure the backend server is running and the API URL is configured correctly.

The tRPC client automatically:
- Includes authentication tokens in requests
- Handles token refresh
- Provides type-safe API calls

## Contributing

1. Follow the existing component patterns
2. Use Tamagui for all UI components
3. Maintain type safety with TypeScript
4. Test on both iOS and Android
5. Ensure web compatibility

## License

Proprietary - LocoMotivate © 2024
