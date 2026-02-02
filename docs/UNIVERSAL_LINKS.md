# Universal Links Setup Guide

This document explains how to configure Universal Links (iOS) and App Links (Android) for the LocoMotivate app.

## Overview

Universal Links allow users to open your app directly from web URLs. When a user taps a link to your website, if your app is installed, it opens directly in the app instead of Safari/Chrome.

## Supported Deep Link Paths

The following paths are configured for universal linking:

| Path Pattern | Description |
|--------------|-------------|
| `/bundle/:id` | Bundle/program detail screen |
| `/trainer/:id` | Trainer profile screen |
| `/conversation/:id` | Conversation/chat screen |
| `/messages` | Messages list screen |
| `/profile` | User profile screen |
| `/checkout` | Checkout screen |
| `/invite/:token` | Invitation acceptance screen |
| `/client/:id` | Client detail screen |
| `/browse` | Browse products screen |
| `/activity` | Activity feed screen |
| `/discover` | Discover bundles screen |

## iOS Setup (Apple App Site Association)

### 1. Configure Associated Domains

The `app.config.ts` already includes the associated domains configuration:

```typescript
ios: {
  associatedDomains: [
    "applinks:locomotivate.app",
    "webcredentials:locomotivate.app",
  ],
}
```

### 2. Host the AASA File

The Apple App Site Association file is located at:
`public/.well-known/apple-app-site-association`

**Important**: Before deploying, update the `TEAM_ID` placeholder with your actual Apple Developer Team ID.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.space.manus.locoman.expo.t20260125130603",
        "paths": ["/bundle/*", "/trainer/*", ...]
      }
    ]
  }
}
```

### 3. Server Requirements

- The AASA file must be served from `https://locomotivate.app/.well-known/apple-app-site-association`
- Content-Type must be `application/json`
- No redirects allowed
- Valid SSL certificate required

## Android Setup (App Links)

### 1. Configure Intent Filters

The `app.config.ts` already includes intent filters for App Links:

```typescript
android: {
  intentFilters: [
    {
      action: "VIEW",
      autoVerify: true,
      data: [
        { scheme: "https", host: "locomotivate.app", pathPrefix: "/bundle" },
        // ... other paths
      ],
      category: ["BROWSABLE", "DEFAULT"],
    },
  ],
}
```

### 2. Host the Asset Links File

The Digital Asset Links file is located at:
`public/.well-known/assetlinks.json`

**Important**: Before deploying, replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your app's signing certificate fingerprint.

To get your SHA256 fingerprint:
```bash
# For debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# For release keystore
keytool -list -v -keystore your-release-key.keystore -alias your-alias
```

### 3. Server Requirements

- The assetlinks.json file must be served from `https://locomotivate.app/.well-known/assetlinks.json`
- Content-Type must be `application/json`
- Valid SSL certificate required

## Testing Universal Links

### iOS Testing

1. Build and install the app on a device
2. Send yourself a link via Messages or Notes (not Safari URL bar)
3. Tap the link - it should open in the app

### Android Testing

1. Build and install the app on a device
2. Use ADB to test:
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "https://locomotivate.app/bundle/123"
   ```

### Web Fallback

If the app is not installed, users will be directed to the web version at the same URL.

## Troubleshooting

### iOS Issues

- **Links open in Safari**: Check that the AASA file is accessible and properly formatted
- **Associated Domains not working**: Ensure your Team ID is correct in the AASA file
- **Development builds**: Associated Domains require a development build, not Expo Go

### Android Issues

- **Links show app chooser**: The assetlinks.json may not be properly verified
- **autoVerify not working**: Check that the SHA256 fingerprint matches your signing key

## Custom Scheme Deep Links

In addition to universal links, the app also supports custom scheme deep links:

```
manus20260125130603://bundle/123
manus20260125130603://trainer/456
```

These work in Expo development builds but not in Expo Go.
