export const ENV = {
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  whisperApiUrl: process.env.WHISPER_API_URL ?? "https://api.groq.com/openai/v1/audio/transcriptions",
  whisperApiKey: process.env.WHISPER_API_KEY ?? process.env.GROQ_API_KEY ?? "",
  llmDefaultProvider: process.env.LLM_DEFAULT_PROVIDER ?? "",
  llmDefaultModel: process.env.LLM_DEFAULT_MODEL ?? "",
  llmChatgptModel: process.env.LLM_CHATGPT_MODEL ?? "",
  llmClaudeModel: process.env.LLM_CLAUDE_MODEL ?? "",
  llmGeminiModel: process.env.LLM_GEMINI_MODEL ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",
  expoPublicAppUrl: process.env.EXPO_PUBLIC_APP_URL ?? "",
  expoPublicApiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  phylloApiBaseUrl:
    process.env.PHYLLO_API_BASE_URL ?? "https://api.staging.getphyllo.com",
  phylloAuthBasic: process.env.PHYLLO_AUTH_BASIC ?? "",
  phylloPeriodicSyncKey: process.env.PHYLLO_PERIODIC_SYNC_KEY ?? "",
  phylloWebhookSecret: process.env.PHYLLO_WEBHOOK_SECRET ?? "",
  phylloName: process.env.PHYLLO_NAME ?? "",
  phylloExternalId: process.env.PHYLLO_EXTERNAL_ID ?? "",
  phylloId: process.env.PHYLLO_ID ?? "",
  phylloSdkToken: process.env.PHYLLO_SDK_TOKEN ?? "",
  phylloSdkTokenExpiresAt: process.env.PHYLLO_SDK_TOKEN_EXPIRES_AT ?? "",
};

export function getConfiguredPhylloEnvironment(): "sandbox" | "staging" | "production" {
  const baseUrl = String(ENV.phylloApiBaseUrl || "").toLowerCase();
  if (baseUrl.includes("staging")) return "staging";
  if (baseUrl.includes("sandbox")) return "sandbox";
  return "production";
}
