# OpenClaw + Waveshare ESP32-S3 Audio Starter

This firmware turns a Waveshare ESP32-S3 Audio board into a simple OpenClaw client.

Current scope:
- Connects board to Wi-Fi
- Sends prompts to OpenClaw `POST /v1/chat/completions`
- Prints assistant replies to serial monitor
- Sends one preset prompt when BOOT button is pressed
- Probes common board I2C devices (`TCA9555`, `ES8311`, `ES7210`) so you can confirm hardware wiring

This is the fastest stable path to get your board talking to OpenClaw today.  
Full native OpenClaw WebSocket node auth requires device key/signature handling and can be layered in next.

## 1) Requirements

- PlatformIO (`pio`) installed
- Waveshare ESP32-S3 Audio board connected over USB
- OpenClaw gateway reachable on your LAN
- OpenClaw OpenAI-compatible endpoint enabled (`/v1/chat/completions`)

## 2) OpenClaw config checklist

On the OpenClaw host:

1. Enable the OpenAI-compatible endpoint.
2. Set gateway auth mode/token (or disable auth for local testing only).
3. Confirm your gateway is reachable from ESP32 (`http://<host>:18789` by default).

Quick smoke test from your laptop:

```bash
curl -sS http://<gateway-host>:18789/v1/chat/completions \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"model":"openclaw","messages":[{"role":"user","content":"ping"}]}'
```

## 3) Configure firmware secrets

```bash
cp src/secrets.example.h src/secrets.h
```

Edit `src/secrets.h`:
- `WIFI_SSID`, `WIFI_PASSWORD`
- `OPENCLAW_HOST`, `OPENCLAW_PORT`
- `OPENCLAW_TOKEN`
- Optional: `OPENCLAW_AGENT_ID`, `OPENCLAW_BUTTON_PROMPT`

## 4) Build + flash

```bash
pio run -t upload
pio device monitor -b 115200
```

## 5) Use it

- Type a prompt in serial monitor and press Enter.
- Press BOOT button to send the preset prompt.

## Notes

- Board profile uses `esp32-s3-devkitc-1` as a generic target.
- If your specific Waveshare variant needs different flash/PSRAM options, update `platformio.ini`.
- This starter does not yet play TTS over the onboard speaker or stream microphone audio to OpenClaw.

