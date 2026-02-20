#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <Wire.h>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Missing secrets.h. Copy src/secrets.example.h to src/secrets.h and fill values."
#endif

#if OPENCLAW_USE_TLS
#include <WiFiClientSecure.h>
#endif

namespace {

constexpr uint32_t kSerialBaud = 115200;
constexpr int kBootButtonPin = 0;
constexpr uint16_t kI2cSdaPin = 11;
constexpr uint16_t kI2cSclPin = 10;

constexpr uint8_t kTca9555Addr = 0x20;
constexpr uint8_t kEs8311Addr = 0x18;
constexpr uint8_t kEs7210Addr = 0x40;

String g_inputLine;
String g_deviceId;
String g_sessionKey;

bool g_bootLatched = false;
uint32_t g_lastBootEdgeMs = 0;

String readDeviceId() {
  const uint64_t mac = ESP.getEfuseMac();
  char out[17];
  snprintf(out, sizeof(out), "%04X%08X", static_cast<uint16_t>(mac >> 32), static_cast<uint32_t>(mac));
  return String(out);
}

bool i2cResponds(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void printBoardProbe() {
  Serial.println();
  Serial.println("I2C probe (expected on Waveshare ESP32-S3-AUDIO):");
  Serial.printf("  0x%02X (TCA9555 IO expander): %s\n", kTca9555Addr, i2cResponds(kTca9555Addr) ? "ok" : "missing");
  Serial.printf("  0x%02X (ES8311 speaker codec): %s\n", kEs8311Addr, i2cResponds(kEs8311Addr) ? "ok" : "missing");
  Serial.printf("  0x%02X (ES7210 mic ADC): %s\n", kEs7210Addr, i2cResponds(kEs7210Addr) ? "ok" : "missing");
  Serial.println();
}

void connectWifiBlocking() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.printf("Connecting Wi-Fi SSID \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts >= 80) {
      Serial.println("\nWi-Fi connection failed; retrying...");
      attempts = 0;
      WiFi.disconnect(true, true);
      delay(500);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  Serial.printf("\nWi-Fi connected, IP=%s\n", WiFi.localIP().toString().c_str());
}

String buildGatewayUrl() {
  const String scheme = OPENCLAW_USE_TLS ? "https://" : "http://";
  return scheme + String(OPENCLAW_HOST) + ":" + String(OPENCLAW_PORT) + "/v1/chat/completions";
}

String extractAssistantText(const String &json) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    return String("[json-parse-error] ") + err.c_str();
  }

  const char *apiError = doc["error"]["message"] | nullptr;
  if (apiError) {
    return String("[openclaw-error] ") + apiError;
  }

  const char *text = doc["choices"][0]["message"]["content"] | nullptr;
  if (!text) {
    return String("[openclaw-error] missing choices[0].message.content");
  }
  return String(text);
}

String askOpenClaw(const String &prompt) {
  connectWifiBlocking();

  JsonDocument bodyDoc;
  bodyDoc["model"] = OPENCLAW_MODEL;
  bodyDoc["user"] = OPENCLAW_USER;

  JsonArray messages = bodyDoc["messages"].to<JsonArray>();
  JsonObject msg = messages.add<JsonObject>();
  msg["role"] = "user";
  msg["content"] = prompt;

  String body;
  serializeJson(bodyDoc, body);

  const String url = buildGatewayUrl();
  HTTPClient http;

#if OPENCLAW_USE_TLS
  WiFiClientSecure client;
  client.setInsecure();
  if (!http.begin(client, url)) {
    return "[http-error] failed to initialize TLS HTTP client";
  }
#else
  WiFiClient client;
  if (!http.begin(client, url)) {
    return "[http-error] failed to initialize HTTP client";
  }
#endif

  http.setTimeout(OPENCLAW_HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-openclaw-agent-id", OPENCLAW_AGENT_ID);
  http.addHeader("x-openclaw-session-key", g_sessionKey);
  if (strlen(OPENCLAW_TOKEN) > 0) {
    http.addHeader("Authorization", String("Bearer ") + OPENCLAW_TOKEN);
  }

  const int code = http.POST(body);
  const String raw = http.getString();
  http.end();

  if (code <= 0) {
    return String("[http-error] POST failed: ") + code;
  }
  if (code >= 400) {
    return String("[http-") + code + "] " + raw;
  }

  return extractAssistantText(raw);
}

void runPrompt(const String &prompt) {
  const String trimmed = prompt;
  if (trimmed.length() == 0) {
    return;
  }

  Serial.println();
  Serial.printf("You: %s\n", trimmed.c_str());
  Serial.println("OpenClaw: thinking...");
  const String reply = askOpenClaw(trimmed);
  Serial.printf("OpenClaw: %s\n", reply.c_str());
  Serial.println();
}

void handleSerialInput() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r') {
      continue;
    }
    if (c == '\n') {
      const String prompt = g_inputLine;
      g_inputLine = "";
      runPrompt(prompt);
      continue;
    }
    if (g_inputLine.length() < 512) {
      g_inputLine += c;
    }
  }
}

void handleBootButton() {
  const int level = digitalRead(kBootButtonPin);
  const uint32_t now = millis();

  if (level == LOW && !g_bootLatched && (now - g_lastBootEdgeMs) > 60) {
    g_bootLatched = true;
    g_lastBootEdgeMs = now;
    runPrompt(String(OPENCLAW_BUTTON_PROMPT));
  } else if (level == HIGH && g_bootLatched && (now - g_lastBootEdgeMs) > 60) {
    g_bootLatched = false;
    g_lastBootEdgeMs = now;
  }
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  delay(500);

  pinMode(kBootButtonPin, INPUT_PULLUP);
  Wire.begin(kI2cSdaPin, kI2cSclPin);

  g_deviceId = readDeviceId();
  g_sessionKey = String("agent:") + OPENCLAW_AGENT_ID + ":openai:esp32-" + g_deviceId;

  Serial.println();
  Serial.println("OpenClaw ESP32 interface starting...");
  Serial.printf("Device ID: %s\n", g_deviceId.c_str());
  Serial.printf("Session key: %s\n", g_sessionKey.c_str());
  Serial.printf("Gateway: %s\n", buildGatewayUrl().c_str());

  printBoardProbe();
  connectWifiBlocking();

  Serial.println("Ready.");
  Serial.println("Type a prompt and press Enter.");
  Serial.println("Press the BOOT button to send OPENCLAW_BUTTON_PROMPT.");
}

void loop() {
  handleSerialInput();
  handleBootButton();
  delay(10);
}
