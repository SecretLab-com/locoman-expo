# Trainer AI Assistant

## What Is Implemented

- Multi-provider LLM selection through a single API:
  - `chatgpt`
  - `claude`
  - `gemini`
  - `auto` (default)
- A trainer automation assistant with tool-calling for:
  - Client listing
  - Bundle listing
  - Bundle recommendations from chat context
  - Invite creation/email sending (confirmation-aware)
  - Graph-ready client value report (`messageCount` vs `revenue`)
- In-app trainer entry points:
  - `Messages` header `Assistant` button
  - `New message` list includes `Loco Assistant`
- Existing chat flow upgraded so messages sent to `Loco Assistant` trigger async AI replies.
- Dedicated trainer assistant screen:
  - `/(trainer)/assistant`
  - Message composer + assistant thread
  - Voice recording + speech transcription into the input box

## API Endpoint

`trpc.ai.trainerAssistant`

Input:

```ts
{
  message: string; // required
  provider?: "auto" | "chatgpt" | "claude" | "gemini";
  allowMutations?: boolean; // default true
  conversationId?: string;  // optional, for context threading
}
```

Response:

```ts
{
  reply: string;
  provider: "chatgpt" | "claude" | "gemini";
  model: string;
  usedTools: string[];
  actions: Array<{
    tool: string;
    status: "success" | "partial" | "preview" | "blocked" | "error";
    summary: string;
  }>;
  graphData: Array<{
    clientId: string;
    clientName: string;
    messageCount: number;
    revenueMinor: number;
    revenue: number;
  }>;
}
```

## Voice Endpoint

`trpc.voice.transcribe`

Input:

```ts
{
  audioUrl: string; // absolute URL or /uploads/... relative path
  language?: string;
  prompt?: string;
}
```

Response: native Whisper verbose JSON (includes `text`, `language`, `duration`, `segments`).

## Provider Configuration

LLM calls go through **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`), which routes to any supported model.

Required env var:

- `OPENROUTER_API_KEY` — get one at https://openrouter.ai/keys

Optional env vars for model selection:

- `LLM_DEFAULT_PROVIDER` — `chatgpt`, `claude`, or `gemini` (default: `gemini`)
- `LLM_DEFAULT_MODEL` — override model for all providers
- `LLM_CHATGPT_MODEL` — override for ChatGPT (default: `openai/gpt-4.1-mini`)
- `LLM_CLAUDE_MODEL` — override for Claude (default: `anthropic/claude-sonnet-4`)
- `LLM_GEMINI_MODEL` — override for Gemini (default: `google/gemini-2.5-flash`)

Model names use OpenRouter format (`provider/model`). See https://openrouter.ai/models for available models.

## Invite Safety Behavior

The invite tool supports preview-first behavior:

- If `confirm` is not true, invite execution returns `preview`.
- To actually send invites, the assistant must call invite tool with `confirm=true`.

## MCP Server (Claude Desktop / Claude Code / Cursor)

Implemented script:

`scripts/mcp-trainer-assistant.ts`

Run it:

```bash
pnpm mcp:trainer-assistant
```

Required env vars:

- `LOCO_API_BASE_URL` (example: `https://services.bright.coach`)
- `LOCO_API_TOKEN` (Supabase access token for the trainer account)

Optional env vars:

- `LOCO_IMPERSONATE_USER_ID` (if token belongs to coordinator and you want trainer impersonation)

Exposed MCP tools:

- `trainer_get_context_snapshot` (profile + core counts)
- `trainer_list_clients`
- `trainer_list_bundles`
- `trainer_list_conversations`
- `trainer_get_conversation_messages`
- `trainer_recommend_bundles_from_chats` (deterministic recommendation scoring)
- `trainer_client_value_report` (graph-ready messages vs revenue report)
- `trainer_invite_client` (confirm-gated mutation)
- `trainer_bulk_invite_clients_to_bundle` (confirm-gated mutation)
- `trainer_invite_from_chat_recs` (confirm-gated end-to-end automation)
- `trainer_assistant_preview` (read-only, no mutations)
- `trainer_assistant_execute` (mutation-capable, requires `confirm=true`)
- `trainer_voice_transcribe` (speech-to-text from audio URL)

Example MCP config block (JSON):

```json
{
  "mcpServers": {
    "locomotivate-trainer": {
      "command": "pnpm",
      "args": ["mcp:trainer-assistant"],
      "env": {
        "LOCO_API_BASE_URL": "https://services.bright.coach",
        "LOCO_API_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN"
      }
    }
  }
}
```

### Cursor Project Setup (already wired in this repo)

This project now includes:

- `.cursor/mcp.json`
- `scripts/run-cursor-mcp.mjs`

`scripts/run-cursor-mcp.mjs` loads `.env` with `dotenv`, then maps:

- `EXPO_PUBLIC_API_BASE_URL -> LOCO_API_BASE_URL` (fallback: `http://localhost:3000`)
- `SUPABASE_ACCESS_TOKEN -> LOCO_API_TOKEN`

So Cursor can start the MCP server without storing secrets inside `.cursor/mcp.json`.

## Primary Use Case

This integration gives an external coding/chat assistant (ChatGPT, Claude, Gemini via MCP-capable clients) an authenticated tool surface to automate trainer workflows in your app:

- Read/plan who should be invited and to which bundle
- Execute invite workflows when explicitly confirmed
- Produce graph-ready client value metrics (messages vs revenue)
- Transcribe voice instructions so trainers can issue spoken commands
