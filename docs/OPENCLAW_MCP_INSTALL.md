# OpenClaw MCP Install (Locomotivate)

This runbook configures OpenClaw to call the Locomotivate MCP endpoint hosted by this backend.

## 1. Exact Locomotivate endpoints and identifiers

From this repo configuration:

- API base URL: `https://services.bright.coach`
- MCP URL: `https://services.bright.coach/mcp`
- Supabase URL: `https://cvtvsfeaqauxlwgykdxb.supabase.co`
- Supabase project ref: `cvtvsfeaqauxlwgykdxb`

## 1.1 In-app connect flow (recommended)

You can now generate OpenClaw connection details directly in the app:

1. Sign in as trainer
2. Open `Trainer -> Settings -> OpenClaw MCP`
3. Tap **Generate OpenClaw Connection**
4. Copy:
   - user token
   - `mcporter` command, or
   - `mcporter` JSON config

If your backend requires endpoint key protection, paste `LOCO_MCP_AUTH_TOKEN` in the in-app key field first. If left blank, copied output keeps `${LOCO_MCP_AUTH_TOKEN}` as a placeholder.

## 2. Auth model (important)

The MCP endpoint uses two auth values with different purposes:

- `X-LOCO-MCP-KEY`: endpoint protection key (`LOCO_MCP_AUTH_TOKEN`)
- `Authorization: Bearer <USER_SUPABASE_ACCESS_TOKEN>`: per-user identity token

Do not use a single global backend token for all users.

### Generate a per-user bearer token (example: `jason@secretlab.com`)

From repo root:

```bash
pnpm run mcp:user-token jason@secretlab.com
```

This prints only the access token so you can export it directly:

```bash
export LOCO_USER_ACCESS_TOKEN="$(pnpm run -s mcp:user-token jason@secretlab.com)"
```

Optional: show decoded metadata (email + expiry) without printing the full token:

```bash
TOKEN="$(pnpm run -s mcp:user-token jason@secretlab.com)"
node -e 'const p=JSON.parse(Buffer.from(process.argv[1].split(".")[1],"base64url").toString("utf8")); console.log({email:p.email, exp:new Date(p.exp*1000).toISOString()});' "$TOKEN"
```

## 3. Backend environment (already-deployed service)

Set these on the backend service (Cloud Run or equivalent):

- `LOCO_MCP_HTTP_ENABLED=true`
- `LOCO_MCP_AUTH_TOKEN=<strong-random-secret>`

Optional fallback vars (used by local stdio mode, not required for `/mcp` request-scoped auth):

- `LOCO_API_TOKEN=<optional>`
- `SUPABASE_ACCESS_TOKEN=<optional>`

## 4. OpenClaw host prerequisites

Install `mcporter` on the OpenClaw host:

```bash
npm i -g mcporter
```

Set runtime env vars on that host:

```bash
export LOCO_MCP_AUTH_TOKEN="<same value as backend>"
export LOCO_USER_ACCESS_TOKEN="<user supabase access JWT>"
```

Notes:

- `LOCO_USER_ACCESS_TOKEN` must be a user bearer token for the specific user.
- For multi-user setups, rotate `LOCO_USER_ACCESS_TOKEN` per active user/session.

## 5. Register MCP in mcporter (recommended command)

```bash
mcporter config add locomotivate-trainer https://services.bright.coach/mcp \
  --scope home \
  --header X-LOCO-MCP-KEY='${LOCO_MCP_AUTH_TOKEN}' \
  --header Authorization='Bearer ${LOCO_USER_ACCESS_TOKEN}' \
  --description "Locomotivate trainer MCP"
```

Verify:

```bash
mcporter list locomotivate-trainer --schema
mcporter call locomotivate-trainer.get_context_snapshot
```

## 6. Machine-readable mcporter config (OpenClaw-consumable)

If you prefer direct config file setup:

Path: `~/.mcporter/mcporter.json`

```json
{
  "mcpServers": {
    "locomotivate-trainer": {
      "description": "Locomotivate trainer MCP",
      "baseUrl": "https://services.bright.coach/mcp",
      "headers": {
        "X-LOCO-MCP-KEY": "${LOCO_MCP_AUTH_TOKEN}",
        "Authorization": "Bearer ${LOCO_USER_ACCESS_TOKEN}"
      }
    }
  }
}
```

Then validate:

```bash
mcporter config get locomotivate-trainer
mcporter call locomotivate-trainer.list_clients
```

## 7. Quick endpoint smoke test (without OpenClaw)

```bash
curl -sS https://services.bright.coach/mcp \
  -H "Content-Type: application/json" \
  -H "X-LOCO-MCP-KEY: ${LOCO_MCP_AUTH_TOKEN}" \
  -H "Authorization: Bearer ${LOCO_USER_ACCESS_TOKEN}" \
  -d '{"jsonrpc":"2.0","id":"init-1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

If auth is wrong, you should get HTTP `401` with JSON-RPC error.

## 8. Optional "connect" script idea

A one-click web button can be added later as:

- Backend route that issues short-lived, user-scoped MCP bearer tokens
- UI button that writes/updates mcporter config on the OpenClaw host
- OAuth/device flow for secure token handoff

For now, the command in section 5 is the reliable setup path.
