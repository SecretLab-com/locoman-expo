import { randomUUID } from "crypto";
import type { BundleDraft, Client, Message as DbMessage, Order, User } from "../db";
import * as db from "../db";
import { getInviteEmailFailureUserMessage, sendInviteEmail } from "./email";
import { invokeLLM, type LLMProvider, type Message, type Tool } from "./llm";
import { logError } from "./logger";

type AssistantActionStatus = "success" | "partial" | "preview" | "blocked" | "error";

export type AssistantGraphPoint = {
  clientId: string;
  clientName: string;
  messageCount: number;
  revenueMinor: number;
  revenue: number;
};

export type AssistantActionSummary = {
  tool: string;
  status: AssistantActionStatus;
  summary: string;
};

export type TrainerAssistantResponse = {
  reply: string;
  provider: Exclude<LLMProvider, "auto">;
  model: string;
  usedTools: string[];
  actions: AssistantActionSummary[];
  graphData: AssistantGraphPoint[];
};

type RuntimeCache = {
  clients?: Client[];
  bundles?: BundleDraft[];
  orders?: Order[];
  messageCountsByClientUserId?: Map<string, number>;
};

type ToolRuntime = {
  trainer: User;
  allowMutations: boolean;
  cache: RuntimeCache;
};

const STOP_WORDS = new Set([
  "about",
  "again",
  "along",
  "also",
  "been",
  "being",
  "between",
  "could",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "only",
  "over",
  "same",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "very",
  "with",
  "your",
]);

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors and fall back to empty arguments.
  }
  return {};
}

function extractTextContent(
  content: string | Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text || ""))
    .join("\n")
    .trim();
}

function toMinor(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100);
    }
  }
  return 0;
}

function extractStrings(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractStrings(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      extractStrings(entry, depth + 1),
    );
  }
  return [];
}

function normalizeWord(word: string): string {
  return word.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .split(/\s+/)
    .map((word) => normalizeWord(word))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function getDirectConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join("-");
}

function toHistoryMessages(conversationMessages: DbMessage[] | undefined, trainerId: string): Message[] {
  if (!conversationMessages?.length) return [];
  return conversationMessages
    .slice(-24)
    .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
    .map((message) => ({
      role: message.senderId === trainerId ? ("user" as const) : ("assistant" as const),
      content: message.content,
    }));
}

async function getTrainerClients(runtime: ToolRuntime): Promise<Client[]> {
  if (!runtime.cache.clients) {
    runtime.cache.clients = await db.getClientsByTrainer(runtime.trainer.id);
  }
  return runtime.cache.clients;
}

async function getTrainerBundles(runtime: ToolRuntime): Promise<BundleDraft[]> {
  if (!runtime.cache.bundles) {
    runtime.cache.bundles = await db.getBundleDraftsByTrainer(runtime.trainer.id);
  }
  return runtime.cache.bundles;
}

async function getTrainerOrders(runtime: ToolRuntime): Promise<Order[]> {
  if (!runtime.cache.orders) {
    runtime.cache.orders = await db.getOrdersByTrainer(runtime.trainer.id);
  }
  return runtime.cache.orders;
}

async function getMessageCountsByClientUserId(runtime: ToolRuntime): Promise<Map<string, number>> {
  if (runtime.cache.messageCountsByClientUserId) {
    return runtime.cache.messageCountsByClientUserId;
  }

  const clients = await getTrainerClients(runtime);
  const clientsWithUser = clients.filter(
    (client): client is Client & { userId: string } => typeof client.userId === "string" && client.userId.length > 0,
  );
  const entries = await Promise.all(
    clientsWithUser.map(async (client) => {
      const conversationId = getDirectConversationId(runtime.trainer.id, client.userId);
      const messages = await db.getMessagesByConversation(conversationId);
      return [client.userId, messages.length] as const;
    }),
  );

  runtime.cache.messageCountsByClientUserId = new Map<string, number>(entries);
  return runtime.cache.messageCountsByClientUserId;
}

function buildRevenueByClient(
  clients: Client[],
  orders: Order[],
): Map<string, number> {
  const revenueByClientId = new Map<string, number>();
  const clientIdSet = new Set(clients.map((client) => client.id));
  const clientIdByEmail = new Map<string, string>();

  for (const client of clients) {
    if (client.email) {
      const key = client.email.trim().toLowerCase();
      if (!clientIdByEmail.has(key)) {
        clientIdByEmail.set(key, client.id);
      }
    }
  }

  for (const order of orders) {
    const amountMinor = toMinor(order.totalAmount);
    if (amountMinor <= 0) continue;

    if (order.clientId && clientIdSet.has(order.clientId)) {
      revenueByClientId.set(
        order.clientId,
        (revenueByClientId.get(order.clientId) || 0) + amountMinor,
      );
      continue;
    }

    if (order.customerEmail) {
      const key = order.customerEmail.trim().toLowerCase();
      const clientId = clientIdByEmail.get(key);
      if (clientId) {
        revenueByClientId.set(clientId, (revenueByClientId.get(clientId) || 0) + amountMinor);
      }
    }
  }

  return revenueByClientId;
}

async function buildClientValueReport(
  runtime: ToolRuntime,
  topN: number,
): Promise<{
  points: AssistantGraphPoint[];
  topByMessages: AssistantGraphPoint[];
  topByRevenue: AssistantGraphPoint[];
  totalClients: number;
}> {
  const [clients, orders, messageCounts] = await Promise.all([
    getTrainerClients(runtime),
    getTrainerOrders(runtime),
    getMessageCountsByClientUserId(runtime),
  ]);
  const revenueByClient = buildRevenueByClient(clients, orders);

  const points = clients.map((client) => {
    const revenueMinor = revenueByClient.get(client.id) || 0;
    const messageCount =
      (client.userId && messageCounts.get(client.userId)) ||
      0;
    return {
      clientId: client.id,
      clientName: client.name || client.email || "Client",
      messageCount,
      revenueMinor,
      revenue: revenueMinor / 100,
    };
  });

  const sortedByRevenue = [...points].sort((a, b) => b.revenueMinor - a.revenueMinor);
  const sortedByMessages = [...points].sort((a, b) => b.messageCount - a.messageCount);
  const limit = Math.max(1, Math.min(topN, points.length || 1));

  return {
    points: sortedByRevenue.slice(0, limit),
    topByMessages: sortedByMessages.slice(0, Math.min(3, sortedByMessages.length)),
    topByRevenue: sortedByRevenue.slice(0, Math.min(3, sortedByRevenue.length)),
    totalClients: points.length,
  };
}

function buildToolSpec(): Tool[] {
  return [
    {
      type: "function",
      function: {
        name: "get_context_snapshot",
        description:
          "Get an overview of the trainer's profile and aggregate counts (clients, bundles, orders, conversations). " +
          "Call this first when you need a quick summary of the trainer's account.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "list_clients",
        description:
          "List the trainer's clients with optional search filtering, message counts, and revenue data.",
        parameters: {
          type: "object",
          properties: {
            search: { type: "string", description: "Filter clients by name, email, or notes." },
            includeMessageCounts: { type: "boolean", default: true },
            includeRevenue: { type: "boolean", default: true },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_bundles",
        description: "List this trainer's bundles/offers with optional status filtering.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: published, draft, pending_review." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_conversations",
        description:
          "List the trainer's conversation summaries showing who they've been chatting with, " +
          "unread counts, and last message preview. Use to find conversation IDs for get_conversation_messages.",
        parameters: {
          type: "object",
          properties: {
            includeAssistant: {
              type: "boolean",
              default: false,
              description: "Include the bot/assistant conversation in results.",
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_conversation_messages",
        description:
          "Fetch the message history for a specific conversation. " +
          "Provide either a conversationId (from list_conversations) or a clientId (from list_clients) to resolve it.",
        parameters: {
          type: "object",
          properties: {
            conversationId: { type: "string" },
            clientId: { type: "string", description: "Client ID — the conversation with this client's linked user will be resolved." },
            limit: { type: "integer", minimum: 1, maximum: 400, default: 60 },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "recommend_bundles_from_chats",
        description:
          "Deterministically score and recommend best-fit bundles per client by matching bundle keywords " +
          "against chat history and client notes. Returns ranked recommendations with match reasons.",
        parameters: {
          type: "object",
          properties: {
            clientIds: { type: "array", items: { type: "string" }, description: "Limit to specific client IDs." },
            bundleDraftIds: { type: "array", items: { type: "string" }, description: "Limit to specific bundle IDs." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "invite_clients_to_bundle",
        description:
          "Create and email invitations for clients to a bundle. " +
          "ALWAYS preview first (confirm=false), then execute only after the trainer explicitly confirms. " +
          "Set confirm=true only when the user says 'yes', 'send it', 'go ahead', etc.",
        parameters: {
          type: "object",
          properties: {
            bundleDraftId: { type: "string" },
            clientIds: { type: "array", items: { type: "string" } },
            emails: { type: "array", items: { type: "string" }, description: "Direct email addresses to invite." },
            message: { type: "string", description: "Optional personal message to include in the invite email." },
            confirm: { type: "boolean", default: false },
            dryRun: { type: "boolean", default: false },
          },
          required: ["bundleDraftId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "build_client_value_report",
        description:
          "Generate graph-ready data showing client engagement (message count) versus revenue. " +
          "Returns per-client data points plus top-N rankings by messages and by revenue.",
        parameters: {
          type: "object",
          properties: {
            topN: { type: "integer", minimum: 1, maximum: 100, default: 12 },
          },
          additionalProperties: false,
        },
      },
    },
  ];
}

type AssistantRunInput = {
  trainer: User;
  prompt: string;
  provider?: LLMProvider;
  allowMutations?: boolean;
  conversationMessages?: DbMessage[];
};

export async function runTrainerAssistant(input: AssistantRunInput): Promise<TrainerAssistantResponse> {
  const runtime: ToolRuntime = {
    trainer: input.trainer,
    allowMutations: input.allowMutations !== false,
    cache: {},
  };
  const tools = buildToolSpec();
  const usedTools = new Set<string>();
  const actions: AssistantActionSummary[] = [];
  let graphData: AssistantGraphPoint[] = [];

  const historyMessages = toHistoryMessages(input.conversationMessages, input.trainer.id);
  const trimmedPrompt = input.prompt.trim();
  const lastHistory = historyMessages[historyMessages.length - 1];
  const promptAlreadyInHistory =
    Boolean(lastHistory) &&
    lastHistory.role === "user" &&
    typeof lastHistory.content === "string" &&
    String(lastHistory.content).trim() === trimmedPrompt;

  const messages: Message[] = [
    {
      role: "system",
      content: [
        "You are Loco Assistant, an AI automation assistant for fitness trainers on the Locomotivate platform.",
        "You have tools to read and act on the trainer's data. Keep responses concise and actionable.",
        "",
        "CRITICAL BEHAVIOR — YOU MUST FOLLOW THIS:",
        "NEVER ask the user for information you can look up with your tools.",
        "If you need ANY data (clients, bundles, conversations, etc.) — CALL THE TOOL FIRST, then present what you found.",
        "BAD: 'Which bundle would you like?' (asking without looking)",
        "GOOD: Call list_bundles, then say 'Here are your bundles: X, Y, Z. Which one should I use for the invite?'",
        "BAD: 'Could you tell me which client?' (asking without looking)",
        "GOOD: Call list_clients, then say 'You have these clients: A, B, C. Which one?'",
        "Always gather context with tools BEFORE asking the user anything.",
        "",
        "AVAILABLE TOOLS:",
        "- get_context_snapshot: Quick overview of trainer profile + counts (clients, bundles, orders, conversations).",
        "- list_clients: List clients with message counts and revenue. Supports search filtering.",
        "- list_bundles: List the trainer's bundles/offers. Filter by status (published, draft).",
        "- list_conversations: List chat summaries with other users. Shows unread counts and last message.",
        "- get_conversation_messages: Read message history for a conversation (by conversationId or clientId).",
        "- recommend_bundles_from_chats: Score and match clients to bundles based on chat context and notes.",
        "- invite_clients_to_bundle: Send invitation emails for a bundle. ALWAYS preview first (confirm=false), only execute with confirm=true after explicit trainer approval.",
        "- build_client_value_report: Generate engagement vs revenue data per client for analytics/graphs.",
        "",
        "WORKFLOW GUIDELINES:",
        "1. For broad questions ('how are things going?', 'give me an overview'), start with get_context_snapshot.",
        "2. For client questions, call list_clients. For deeper context, follow up with get_conversation_messages.",
        "3. When the user wants to invite someone, IMMEDIATELY call list_bundles to get available bundles, then suggest the best fit or present the top options. Do NOT ask 'which bundle?' without showing them what's available.",
        "4. When the user mentions a task that requires context (conversations, clients, bundles), gather that context with tools BEFORE responding. Chain multiple tool calls in one turn.",
        "5. For analytics, call build_client_value_report and summarize the key takeaways.",
        "6. For recommendations, call recommend_bundles_from_chats and present the matches with reasoning.",
        "7. When asked to review conversations or check what clients are asking about, call list_conversations AND get_conversation_messages in the same turn. Read the actual messages and summarize what people are discussing. Do NOT stop after listing conversations — always read the messages too.",
        "",
        "SAFETY RULES:",
        "- Never send invites (confirm=true) without explicit trainer confirmation.",
        "- Always preview invites first and ask for confirmation before sending.",
        "- If a tool returns an error, explain clearly and suggest what to try.",
        "- Keep responses short and practical. Trainers are busy — don't be verbose.",
      ].join("\n"),
    },
    ...historyMessages,
  ];
  if (!promptAlreadyInHistory) {
    messages.push({ role: "user", content: trimmedPrompt });
  }

  let finalReply = "";
  let finalProvider: Exclude<LLMProvider, "auto"> = "gemini";
  let finalModel = "";

  const handleListClients = async (args: Record<string, unknown>) => {
    const search = asString(args.search)?.toLowerCase();
    const includeMessageCounts = asBoolean(args.includeMessageCounts, true);
    const includeRevenue = asBoolean(args.includeRevenue, true);
    const clients = await getTrainerClients(runtime);
    const filtered = search
      ? clients.filter((client) =>
          [client.name, client.email, client.notes]
            .map((value) => String(value || "").toLowerCase())
            .some((value) => value.includes(search)),
        )
      : clients;

    const [messageCounts, revenueByClient] = await Promise.all([
      includeMessageCounts ? getMessageCountsByClientUserId(runtime) : Promise.resolve(new Map<string, number>()),
      includeRevenue ? getTrainerOrders(runtime).then((orders) => buildRevenueByClient(filtered, orders)) : Promise.resolve(new Map<string, number>()),
    ]);

    return {
      total: filtered.length,
      clients: filtered.map((client) => ({
        id: client.id,
        userId: client.userId,
        name: client.name,
        email: client.email,
        status: client.status,
        notes: client.notes,
        messageCount:
          includeMessageCounts && client.userId
            ? messageCounts.get(client.userId) || 0
            : undefined,
        revenueMinor: includeRevenue ? revenueByClient.get(client.id) || 0 : undefined,
      })),
    };
  };

  const handleListBundles = async (args: Record<string, unknown>) => {
    const statusFilter = asString(args.status)?.toLowerCase();
    const bundles = await getTrainerBundles(runtime);
    const rows = statusFilter
      ? bundles.filter((bundle) => String(bundle.status || "").toLowerCase() === statusFilter)
      : bundles;

    return {
      total: rows.length,
      bundles: rows.map((bundle) => ({
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        status: bundle.status,
        price: bundle.price,
        cadence: bundle.cadence,
      })),
    };
  };

  const handleRecommendBundlesFromChats = async (args: Record<string, unknown>) => {
    const requestedClientIds = new Set(asStringArray(args.clientIds));
    const requestedBundleIds = new Set(asStringArray(args.bundleDraftIds));
    const clients = await getTrainerClients(runtime);
    const bundles = (await getTrainerBundles(runtime)).filter((bundle) => {
      const isPublished = String(bundle.status || "").toLowerCase() === "published";
      if (requestedBundleIds.size > 0) {
        return requestedBundleIds.has(bundle.id);
      }
      return isPublished;
    });

    const targetClients = clients.filter((client) => {
      if (!client.userId) return false;
      if (requestedClientIds.size === 0) return true;
      return requestedClientIds.has(client.id);
    });

    const bundleTokenData = bundles.map((bundle) => {
      const bundleContext = [
        bundle.title,
        bundle.description || "",
        ...extractStrings(bundle.goalsJson),
      ].join(" ");
      return {
        bundle,
        tokens: new Set(tokenize(bundleContext)),
      };
    });

    const recommendations: Array<{
      clientId: string;
      clientName: string;
      bundleDraftId: string;
      bundleTitle: string;
      score: number;
      matchedKeywords: string[];
    }> = [];

    for (const client of targetClients) {
      const conversationId = getDirectConversationId(runtime.trainer.id, client.userId!);
      const messagesInThread = await db.getMessagesByConversation(conversationId);
      const transcript = messagesInThread
        .slice(-120)
        .map((message) => String(message.content || ""))
        .join(" ");
      const clientContext = `${client.notes || ""} ${transcript}`.trim();
      const clientTokenSet = new Set(tokenize(clientContext));
      if (clientTokenSet.size === 0) continue;

      let bestMatch:
        | {
            bundleDraftId: string;
            bundleTitle: string;
            score: number;
            matchedKeywords: string[];
          }
        | null = null;

      for (const candidate of bundleTokenData) {
        const overlap = Array.from(candidate.tokens).filter((token) => clientTokenSet.has(token));
        const score = overlap.length;
        if (score <= 0) continue;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            bundleDraftId: candidate.bundle.id,
            bundleTitle: candidate.bundle.title,
            score,
            matchedKeywords: overlap.slice(0, 8),
          };
        }
      }

      if (bestMatch) {
        recommendations.push({
          clientId: client.id,
          clientName: client.name || client.email || "Client",
          ...bestMatch,
        });
      }
    }

    recommendations.sort((a, b) => b.score - a.score);

    return {
      totalClientsEvaluated: targetClients.length,
      totalRecommendations: recommendations.length,
      recommendations,
    };
  };

  const handleInviteClientsToBundle = async (args: Record<string, unknown>) => {
    const bundleDraftId = asString(args.bundleDraftId);
    if (!bundleDraftId) {
      return {
        status: "error",
        summary: "bundleDraftId is required.",
      };
    }

    const bundle = await db.getBundleDraftById(bundleDraftId);
    if (!bundle || bundle.trainerId !== runtime.trainer.id) {
      return {
        status: "error",
        summary: "Bundle was not found or does not belong to this trainer.",
      };
    }

    const confirm = asBoolean(args.confirm, false);
    const dryRun = asBoolean(args.dryRun, false);
    const personalMessage = asString(args.message);
    const clientIds = asStringArray(args.clientIds);
    const directEmails = asStringArray(args.emails);
    const clients = await getTrainerClients(runtime);
    const clientsById = new Map(clients.map((client) => [client.id, client]));

    const invalidClientIds: string[] = [];
    const missingEmailClientIds: string[] = [];
    const recipients: Array<{ email: string; name?: string | null; source: string }> = [];

    for (const clientId of clientIds) {
      const client = clientsById.get(clientId);
      if (!client) {
        invalidClientIds.push(clientId);
        continue;
      }
      if (!client.email) {
        missingEmailClientIds.push(clientId);
        continue;
      }
      recipients.push({
        email: client.email,
        name: client.name,
        source: `client:${client.id}`,
      });
    }

    for (const email of directEmails) {
      recipients.push({
        email,
        source: "email",
      });
    }

    const dedupedRecipients = Array.from(
      new Map(
        recipients.map((recipient) => [
          recipient.email.trim().toLowerCase(),
          {
            ...recipient,
            email: recipient.email.trim(),
          },
        ]),
      ).values(),
    );

    if (dedupedRecipients.length === 0) {
      return {
        status: "blocked",
        summary: "No valid recipients with an email address were provided.",
        invalidClientIds,
        missingEmailClientIds,
      };
    }

    if (!runtime.allowMutations) {
      return {
        status: "blocked",
        summary: "Mutating tools are disabled for this request.",
        invitationCount: dedupedRecipients.length,
      };
    }

    if (!confirm || dryRun) {
      return {
        status: "preview",
        summary:
          "Preview only. Re-run with confirm=true to execute invitation sends.",
        invitationCount: dedupedRecipients.length,
        recipients: dedupedRecipients.map((recipient) => ({
          email: recipient.email,
          source: recipient.source,
        })),
        invalidClientIds,
        missingEmailClientIds,
      };
    }

    const successes: Array<{ email: string; invitationToken: string }> = [];
    const failures: Array<{ email: string; error: string }> = [];

    for (const recipient of dedupedRecipients) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      try {
        await db.createInvitation({
          trainerId: runtime.trainer.id,
          email: recipient.email,
          name: recipient.name || null,
          token,
          bundleDraftId,
          expiresAt,
        });
        await sendInviteEmail({
          to: recipient.email,
          token,
          recipientName: recipient.name || null,
          trainerName: runtime.trainer.name || runtime.trainer.email || "Your trainer",
          expiresAtIso: expiresAt,
          personalMessage,
        });
        successes.push({
          email: recipient.email,
          invitationToken: token,
        });
      } catch (error) {
        logError("assistant.invite_clients_to_bundle.failed", error, {
          trainerId: runtime.trainer.id,
          email: recipient.email,
        });
        failures.push({
          email: recipient.email,
          error: getInviteEmailFailureUserMessage(error),
        });
      }
    }

    const status: AssistantActionStatus =
      failures.length === 0 ? "success" : successes.length > 0 ? "partial" : "error";
    const summary =
      failures.length === 0
        ? `Sent ${successes.length} invitation${successes.length === 1 ? "" : "s"}.`
        : `Sent ${successes.length}, failed ${failures.length}.`;

    return {
      status,
      summary,
      sent: successes.length,
      failed: failures.length,
      successes,
      failures,
      invalidClientIds,
      missingEmailClientIds,
    };
  };

  const handleBuildClientValueReport = async (args: Record<string, unknown>) => {
    const topN = asPositiveInt(args.topN, 12);
    return buildClientValueReport(runtime, topN);
  };

  const handleGetContextSnapshot = async () => {
    const [clients, bundles, orders] = await Promise.all([
      getTrainerClients(runtime),
      getTrainerBundles(runtime),
      getTrainerOrders(runtime),
    ]);
    const conversations = await db.getConversationSummaries(runtime.trainer.id);
    return {
      trainerId: runtime.trainer.id,
      trainerName: runtime.trainer.name,
      trainerEmail: runtime.trainer.email,
      role: runtime.trainer.role,
      counts: {
        clients: clients.length,
        bundles: bundles.length,
        publishedBundles: bundles.filter((b) => String(b.status || "").toLowerCase() === "published").length,
        orders: orders.length,
        conversations: conversations.length,
      },
    };
  };

  const handleListConversations = async (args: Record<string, unknown>) => {
    const includeAssistant = asBoolean(args.includeAssistant, false);
    const summaries = await db.getConversationSummaries(runtime.trainer.id);
    const filtered = summaries.filter((s) => {
      if (includeAssistant) return true;
      return !s.conversationId.startsWith("bot-");
    });
    return {
      total: filtered.length,
      conversations: filtered.map((s) => ({
        conversationId: s.conversationId,
        participants: s.participants.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
        })),
        unreadCount: s.unreadCount,
        lastMessageContent: s.lastMessage?.content || null,
        lastMessageAt: s.lastMessage?.createdAt || null,
      })),
    };
  };

  const handleGetConversationMessages = async (args: Record<string, unknown>) => {
    let resolvedConversationId = asString(args.conversationId);
    const clientId = asString(args.clientId);
    const limit = asPositiveInt(args.limit, 60);

    if (!resolvedConversationId && clientId) {
      const clients = await getTrainerClients(runtime);
      const target = clients.find((c) => c.id === clientId);
      if (!target) return { error: `Client not found: ${clientId}` };
      if (!target.userId) return { error: `Client ${clientId} has no linked userId for chat lookup.` };
      resolvedConversationId = getDirectConversationId(runtime.trainer.id, target.userId);
    }

    if (!resolvedConversationId) {
      return { error: "conversationId or clientId is required." };
    }

    const thread = await db.getMessagesByConversation(resolvedConversationId);
    const recent = thread.slice(-limit);
    return {
      conversationId: resolvedConversationId,
      totalMessages: thread.length,
      returned: recent.length,
      messages: recent.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        createdAt: m.createdAt,
        messageType: m.messageType || "text",
      })),
    };
  };

  const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
    get_context_snapshot: handleGetContextSnapshot,
    list_clients: handleListClients,
    list_bundles: handleListBundles,
    list_conversations: handleListConversations,
    get_conversation_messages: handleGetConversationMessages,
    recommend_bundles_from_chats: handleRecommendBundlesFromChats,
    invite_clients_to_bundle: handleInviteClientsToBundle,
    build_client_value_report: handleBuildClientValueReport,
  };

  for (let step = 0; step < 10; step += 1) {
    const llmResult = await invokeLLM({
      provider: input.provider || "auto",
      messages,
      tools,
      toolChoice: "auto",
      maxTokens: 2000,
    });

    finalProvider = llmResult.provider || finalProvider;
    finalModel = llmResult.model || finalModel;
    const choice = llmResult.choices[0];
    if (!choice?.message) {
      continue;
    }

    const assistantText = extractTextContent(choice.message.content as any);
    if (assistantText) {
      finalReply = assistantText;
    }

    const toolCalls = choice.message.tool_calls || [];
    messages.push({
      role: "assistant",
      content: assistantText || "",
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    if (toolCalls.length === 0) {
      break;
    }

    for (const call of toolCalls) {
      const toolName = call.function.name;
      usedTools.add(toolName);
      const handler = handlers[toolName];

      if (!handler) {
        const unknownPayload = {
          error: `Unknown tool: ${toolName}`,
        };
        messages.push({
          role: "tool",
          name: toolName,
          tool_call_id: call.id,
          content: JSON.stringify(unknownPayload),
        });
        actions.push({
          tool: toolName,
          status: "error",
          summary: unknownPayload.error,
        });
        continue;
      }

      const args = parseToolArgs(call.function.arguments || "{}");
      try {
        const result = await handler(args);
        messages.push({
          role: "tool",
          name: toolName,
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        if (toolName === "build_client_value_report") {
          const report = result as {
            points?: AssistantGraphPoint[];
          };
          if (Array.isArray(report.points)) {
            graphData = report.points.map((point) => ({
              clientId: String(point.clientId),
              clientName: String(point.clientName),
              messageCount: Number(point.messageCount || 0),
              revenueMinor: Number(point.revenueMinor || 0),
              revenue: Number(point.revenue || 0),
            }));
          }
        }

        if (toolName === "invite_clients_to_bundle") {
          const status = asString((result as { status?: string }).status) || "preview";
          const summary = asString((result as { summary?: string }).summary) || "Invite tool completed.";
          actions.push({
            tool: toolName,
            status:
              status === "success" ||
              status === "partial" ||
              status === "preview" ||
              status === "blocked" ||
              status === "error"
                ? (status as AssistantActionStatus)
                : "preview",
            summary,
          });
        }
      } catch (error) {
        logError("assistant.tool_execution.failed", error, {
          toolName,
          trainerId: runtime.trainer.id,
        });
        const payload = {
          error: error instanceof Error ? error.message : "Tool execution failed",
        };
        messages.push({
          role: "tool",
          name: toolName,
          tool_call_id: call.id,
          content: JSON.stringify(payload),
        });
        actions.push({
          tool: toolName,
          status: "error",
          summary: payload.error,
        });
      }
    }
  }

  if (!finalReply.trim()) {
    finalReply = "I’m ready. Ask me to analyze clients, recommend bundles, or prepare invites.";
  }

  return {
    reply: finalReply,
    provider: finalProvider,
    model: finalModel || "unknown",
    usedTools: Array.from(usedTools),
    actions,
    graphData,
  };
}
