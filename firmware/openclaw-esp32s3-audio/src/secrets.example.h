#pragma once

// Copy this file to src/secrets.h and fill in your values.

// Wi-Fi settings
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// OpenClaw gateway HTTP endpoint
#define OPENCLAW_HOST "192.168.1.50"
#define OPENCLAW_PORT 18789
#define OPENCLAW_USE_TLS 0

// OpenClaw auth token (leave empty only if auth is disabled)
#define OPENCLAW_TOKEN "secret"

// OpenClaw request tuning
#define OPENCLAW_MODEL "openclaw"
#define OPENCLAW_AGENT_ID "main"
#define OPENCLAW_HTTP_TIMEOUT_MS 45000
#define OPENCLAW_USER "esp32-speaker"

// Hardware behavior
#define OPENCLAW_BUTTON_PROMPT "Give me a short status update."

