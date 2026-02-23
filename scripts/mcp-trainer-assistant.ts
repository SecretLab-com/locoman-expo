#!/usr/bin/env node
import "dotenv/config";

import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import superjson from "superjson";
import { z } from "zod";

import type { AppRouter } from "../server/routers";

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const apiBaseUrl = (process.env.LOCO_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL)
  .trim()
  .replace(/\/+$/g, "");
const authToken = (process.env.LOCO_API_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const impersonateUserId = (process.env.LOCO_IMPERSONATE_USER_ID || "").trim();

if (!authToken) {
  console.error(
    "Missing LOCO_API_TOKEN. Set LOCO_API_TOKEN (or SUPABASE_ACCESS_TOKEN) before starting this MCP server.",
  );
  process.exit(1);
}

const trpcUrl = `${apiBaseUrl}/api/trpc`;

const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${authToken}`,
        };
        if (impersonateUserId) {
          headers["X-Impersonate-User-Id"] = impersonateUserId;
        }
        return headers;
      },
    }),
  ],
});

type ClientLite = {
  id: string;
  trainerId?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  goals?: unknown;
  status?: string | null;
  activeBundles?: number;
  totalSpent?: number;
};

type BundleLite = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  price?: string | null;
  cadence?: string | null;
  goalsJson?: unknown;
  servicesJson?: unknown;
  productsJson?: unknown;
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

function toErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function asCleanString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
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

function extractStrings(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
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

function toMinor(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return 0;
}

function toDirectConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join("-");
}

function toStructuredContent(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { data: value };
}

function toTextResult(text: string, structuredContent?: unknown): any {
  const normalized = toStructuredContent(structuredContent);
  return {
    content: [{ type: "text" as const, text }],
    ...(normalized ? { structuredContent: normalized } : {}),
  };
}

function toErrorResult(text: string): any {
  return {
    isError: true,
    content: [{ type: "text" as const, text }],
  };
}

function formatAssistantResponse(result: {
  reply: string;
  provider: string;
  model: string;
  usedTools: string[];
  actions: Array<{ tool: string; status: string; summary: string }>;
  graphData: Array<{ clientName: string; messageCount: number; revenue: number }>;
}): string {
  const lines: string[] = [];
  lines.push(`Provider: ${result.provider} (${result.model})`);
  lines.push("");
  lines.push(result.reply || "No reply content.");

  if (result.actions.length > 0) {
    lines.push("");
    lines.push("Actions:");
    for (const action of result.actions) {
      lines.push(`- ${action.tool}: ${action.status} - ${action.summary}`);
    }
  }

  if (result.usedTools.length > 0) {
    lines.push("");
    lines.push(`Used tools: ${result.usedTools.join(", ")}`);
  }

  if (result.graphData.length > 0) {
    lines.push("");
    lines.push("Graph data points:");
    for (const point of result.graphData) {
      lines.push(`- ${point.clientName}: messages=${point.messageCount}, revenue=${point.revenue}`);
    }
  }

  return lines.join("\n");
}

async function fetchTrainerCoreData() {
  const [profile, clientsRaw, bundlesRaw, ordersRaw, conversationsRaw] = await Promise.all([
    trpcClient.profile.get.query(),
    trpcClient.clients.list.query(),
    trpcClient.bundles.list.query(),
    trpcClient.orders.list.query(),
    trpcClient.messages.conversations.query(),
  ]);

  const clients = (clientsRaw || []) as unknown as ClientLite[];
  const bundles = (bundlesRaw || []) as unknown as BundleLite[];
  const orders = (ordersRaw || []) as unknown as Array<Record<string, unknown>>;
  const conversations = (conversationsRaw || []) as unknown as Array<Record<string, unknown>>;

  return { profile, clients, bundles, orders, conversations };
}

async function fetchThreadsByConversationIds(conversationIds: string[]) {
  const uniqueIds = Array.from(new Set(conversationIds.filter(Boolean)));
  const entries = await Promise.all(
    uniqueIds.map(async (conversationId) => {
      try {
        const thread = await trpcClient.messages.thread.query({ conversationId });
        return [conversationId, thread as Array<Record<string, unknown>>] as const;
      } catch {
        return [conversationId, [] as Array<Record<string, unknown>>] as const;
      }
    }),
  );
  return new Map<string, Array<Record<string, unknown>>>(entries);
}

type RecommendationResult = {
  recommendations: Array<{
    clientId: string;
    clientName: string;
    clientEmail: string | null;
    clientUserId: string | null;
    bundleDraftId: string;
    bundleTitle: string;
    score: number;
    matchedKeywords: string[];
    messageCount: number;
    reason: string;
  }>;
  skippedClients: Array<{
    clientId: string;
    clientName: string;
    reason: string;
  }>;
  consideredClients: number;
  consideredBundles: number;
};

async function buildChatBasedBundleRecommendations(input: {
  clientIds?: string[];
  bundleIds?: string[];
  publishedOnly: boolean;
  minScore: number;
  maxMessagesPerClient: number;
}): Promise<RecommendationResult> {
  const { profile, clients, bundles, conversations } = await fetchTrainerCoreData();
  const trainerId = asCleanString((profile as any)?.id);
  const requestedClientIds = new Set((input.clientIds || []).map((id) => id.trim()).filter(Boolean));
  const requestedBundleIds = new Set((input.bundleIds || []).map((id) => id.trim()).filter(Boolean));

  const filteredClients = clients.filter((client) => {
    if (requestedClientIds.size === 0) return true;
    return requestedClientIds.has(String(client.id || ""));
  });
  const filteredBundles = bundles.filter((bundle) => {
    const id = String(bundle.id || "");
    if (requestedBundleIds.size > 0 && !requestedBundleIds.has(id)) return false;
    if (!input.publishedOnly) return true;
    return String(bundle.status || "").toLowerCase() === "published";
  });

  const bundleTokenData = filteredBundles.map((bundle) => {
    const bundleText = [
      asCleanString(bundle.title),
      asCleanString(bundle.description),
      ...extractStrings(bundle.goalsJson),
      ...extractStrings(bundle.servicesJson),
      ...extractStrings(bundle.productsJson),
    ].join(" ");
    return {
      bundle,
      tokens: new Set(tokenize(bundleText)),
    };
  });

  const conversationIdByUserId = new Map<string, string>();
  for (const conversation of conversations) {
    const otherUserId = asCleanString((conversation as any).otherUserId);
    const conversationId = asCleanString((conversation as any).conversationId || (conversation as any).id);
    if (otherUserId && conversationId && !conversationIdByUserId.has(otherUserId)) {
      conversationIdByUserId.set(otherUserId, conversationId);
    }
  }

  const expectedConversationIds = filteredClients
    .map((client) => {
      const userId = asCleanString(client.userId);
      if (!userId || !trainerId) return "";
      return conversationIdByUserId.get(userId) || toDirectConversationId(trainerId, userId);
    })
    .filter(Boolean);

  const threadsByConversation = await fetchThreadsByConversationIds(expectedConversationIds);

  const recommendations: RecommendationResult["recommendations"] = [];
  const skippedClients: RecommendationResult["skippedClients"] = [];

  for (const client of filteredClients) {
    const clientId = String(client.id || "");
    const clientName = asCleanString(client.name) || "Client";
    const userId = asCleanString(client.userId) || null;
    const email = asCleanString(client.email) || null;

    if (bundleTokenData.length === 0) {
      skippedClients.push({
        clientId,
        clientName,
        reason: "No bundles available for scoring.",
      });
      continue;
    }

    const contextParts: string[] = [];
    const notes = asCleanString(client.notes);
    if (notes) contextParts.push(notes);
    contextParts.push(...extractStrings(client.goals));

    let messageCount = 0;
    if (userId) {
      const conversationId = conversationIdByUserId.get(userId) || (trainerId ? toDirectConversationId(trainerId, userId) : "");
      const thread = conversationId ? (threadsByConversation.get(conversationId) || []) : [];
      const recent = thread.slice(-Math.max(1, input.maxMessagesPerClient));
      messageCount = thread.length;
      for (const message of recent) {
        const content = asCleanString((message as any).content);
        if (content) contextParts.push(content);
      }
    }

    const clientTokens = new Set(tokenize(contextParts.join(" ")));
    if (clientTokens.size === 0) {
      skippedClients.push({
        clientId,
        clientName,
        reason: "No notes or chat text to score against bundles.",
      });
      continue;
    }

    let bestMatch:
      | {
          bundleId: string;
          bundleTitle: string;
          score: number;
          overlap: string[];
        }
      | undefined;

    for (const candidate of bundleTokenData) {
      const overlap: string[] = [];
      for (const token of clientTokens) {
        if (candidate.tokens.has(token)) overlap.push(token);
      }
      const score = overlap.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          bundleId: String(candidate.bundle.id || ""),
          bundleTitle: asCleanString(candidate.bundle.title) || "Bundle",
          score,
          overlap: overlap.slice(0, 8),
        };
      }
    }

    if (!bestMatch || bestMatch.score < input.minScore) {
      skippedClients.push({
        clientId,
        clientName,
        reason: `Best score below threshold (${input.minScore}).`,
      });
      continue;
    }

    const reason =
      bestMatch.overlap.length > 0
        ? `Matched on keywords: ${bestMatch.overlap.join(", ")}`
        : "Matched on overall similarity.";

    recommendations.push({
      clientId,
      clientName,
      clientEmail: email,
      clientUserId: userId,
      bundleDraftId: bestMatch.bundleId,
      bundleTitle: bestMatch.bundleTitle,
      score: bestMatch.score,
      matchedKeywords: bestMatch.overlap,
      messageCount,
      reason,
    });
  }

  recommendations.sort((a, b) => b.score - a.score || b.messageCount - a.messageCount);

  return {
    recommendations,
    skippedClients,
    consideredClients: filteredClients.length,
    consideredBundles: filteredBundles.length,
  };
}

async function buildClientValueReport(input: { clientIds?: string[]; topN: number }) {
  const { profile, clients, orders, conversations } = await fetchTrainerCoreData();
  const trainerId = asCleanString((profile as any)?.id);
  const requestedClientIds = new Set((input.clientIds || []).map((id) => id.trim()).filter(Boolean));
  const filteredClients = clients.filter((client) => {
    if (requestedClientIds.size === 0) return true;
    return requestedClientIds.has(String(client.id || ""));
  });

  const conversationIdByUserId = new Map<string, string>();
  for (const conversation of conversations) {
    const otherUserId = asCleanString((conversation as any).otherUserId);
    const conversationId = asCleanString((conversation as any).conversationId || (conversation as any).id);
    if (otherUserId && conversationId && !conversationIdByUserId.has(otherUserId)) {
      conversationIdByUserId.set(otherUserId, conversationId);
    }
  }

  const expectedConversationIds = filteredClients
    .map((client) => {
      const userId = asCleanString(client.userId);
      if (!userId || !trainerId) return "";
      return conversationIdByUserId.get(userId) || toDirectConversationId(trainerId, userId);
    })
    .filter(Boolean);

  const threadsByConversation = await fetchThreadsByConversationIds(expectedConversationIds);

  const points = filteredClients.map((client) => {
    const clientId = String(client.id || "");
    const clientName = asCleanString(client.name) || "Client";
    const userId = asCleanString(client.userId) || null;
    const email = asCleanString(client.email).toLowerCase();

    const conversationId = userId
      ? conversationIdByUserId.get(userId) || (trainerId ? toDirectConversationId(trainerId, userId) : "")
      : "";
    const thread = conversationId ? (threadsByConversation.get(conversationId) || []) : [];
    const messageCount = thread.length;

    let revenueMinor = 0;
    for (const order of orders) {
      const orderClientId = asCleanString((order as any).clientId);
      const orderEmail = asCleanString((order as any).customerEmail).toLowerCase();
      const orderName = asCleanString((order as any).customerName);
      const clientNameLocal = asCleanString(client.name);

      let matched = false;
      if (userId && orderClientId && orderClientId === userId) {
        matched = true;
      } else if (!matched && email && orderEmail && email === orderEmail) {
        matched = true;
      } else if (!matched && !email && clientNameLocal && orderName && clientNameLocal === orderName) {
        matched = true;
      }

      if (matched) {
        revenueMinor += toMinor((order as any).totalAmount as string | number | null | undefined);
      }
    }

    return {
      clientId,
      clientName,
      clientUserId: userId,
      email: email || null,
      messageCount,
      revenueMinor,
      revenue: revenueMinor / 100,
    };
  });

  const sortedByMessages = [...points].sort((a, b) => b.messageCount - a.messageCount).slice(0, input.topN);
  const sortedByRevenue = [...points].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, input.topN);
  const sortedBalanced = [...points]
    .sort((a, b) => {
      const aScore = a.messageCount * 0.4 + a.revenue * 0.6;
      const bScore = b.messageCount * 0.4 + b.revenue * 0.6;
      return bScore - aScore;
    })
    .slice(0, input.topN);

  const totals = points.reduce(
    (acc, point) => {
      acc.totalMessages += point.messageCount;
      acc.totalRevenueMinor += point.revenueMinor;
      return acc;
    },
    { totalMessages: 0, totalRevenueMinor: 0 },
  );

  return {
    points,
    sortedByMessages,
    sortedByRevenue,
    sortedBalanced,
    totals: {
      totalMessages: totals.totalMessages,
      totalRevenueMinor: totals.totalRevenueMinor,
      totalRevenue: totals.totalRevenueMinor / 100,
    },
  };
}

const server = new McpServer({
  name: "locomotivate-trainer-assistant",
  version: "1.1.0",
});

server.registerTool(
  "trainer_get_context_snapshot",
  {
    title: "Trainer Context Snapshot",
    description: "Fetch a snapshot of trainer profile and core counts (clients, bundles, orders, conversations).",
    annotations: { readOnlyHint: true },
    inputSchema: {},
  },
  async () => {
    try {
      const { profile, clients, bundles, orders, conversations } = await fetchTrainerCoreData();
      const snapshot = {
        trainerId: (profile as any)?.id || null,
        trainerName: (profile as any)?.name || null,
        role: (profile as any)?.role || null,
        counts: {
          clients: clients.length,
          bundles: bundles.length,
          publishedBundles: bundles.filter((bundle) => asCleanString(bundle.status).toLowerCase() === "published")
            .length,
          orders: orders.length,
          conversations: conversations.length,
        },
      };
      return toTextResult(
        `Trainer ${snapshot.trainerName || snapshot.trainerId || "unknown"}: ${snapshot.counts.clients} clients, ${snapshot.counts.publishedBundles}/${snapshot.counts.bundles} published bundles, ${snapshot.counts.orders} orders.`,
        snapshot,
      );
    } catch (error) {
      return toErrorResult(`Snapshot failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_list_clients",
  {
    title: "List Clients",
    description: "List trainer clients with optional filtering.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      status: z.string().optional().describe("Optional status filter (active, pending, inactive, removed)."),
      includeNotes: z.boolean().default(false),
    },
  },
  async ({ status, includeNotes }) => {
    try {
      const clients = (await trpcClient.clients.list.query()) as unknown as ClientLite[];
      const normalizedStatus = asCleanString(status).toLowerCase();
      const filtered = clients.filter((client) => {
        if (!normalizedStatus) return true;
        return asCleanString(client.status).toLowerCase() === normalizedStatus;
      });

      const rows = filtered.map((client) => ({
        id: client.id,
        userId: client.userId || null,
        name: client.name || "Client",
        email: client.email || null,
        phone: client.phone || null,
        status: client.status || null,
        activeBundles: client.activeBundles ?? 0,
        totalSpent: client.totalSpent ?? 0,
        ...(includeNotes ? { notes: client.notes || null } : {}),
      }));

      return toTextResult(`Returned ${rows.length} clients.`, { clients: rows });
    } catch (error) {
      return toErrorResult(`List clients failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_list_bundles",
  {
    title: "List Bundles",
    description: "List trainer bundles/offers with optional status filtering.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      status: z.string().optional().describe("Optional status filter (published, draft, pending_review)."),
    },
  },
  async ({ status }) => {
    try {
      const bundles = (await trpcClient.bundles.list.query()) as unknown as BundleLite[];
      const statusFilter = asCleanString(status).toLowerCase();
      const filtered = bundles.filter((bundle) => {
        if (!statusFilter) return true;
        return asCleanString(bundle.status).toLowerCase() === statusFilter;
      });

      const rows = filtered.map((bundle) => ({
        id: bundle.id,
        title: bundle.title || "Untitled bundle",
        description: bundle.description || null,
        status: bundle.status || null,
        price: bundle.price || null,
        cadence: bundle.cadence || null,
      }));

      return toTextResult(`Returned ${rows.length} bundles.`, { bundles: rows });
    } catch (error) {
      return toErrorResult(`List bundles failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_list_conversations",
  {
    title: "List Conversations",
    description: "List trainer conversation summaries for client chat context.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      includeAssistant: z.boolean().default(false),
    },
  },
  async ({ includeAssistant }) => {
    try {
      const conversations = (await trpcClient.messages.conversations.query()) as unknown as Array<Record<string, unknown>>;
      const rows = conversations
        .filter((conversation) => {
          const conversationId = asCleanString((conversation as any).conversationId || (conversation as any).id);
          if (includeAssistant) return true;
          return !conversationId.startsWith("bot-");
        })
        .map((conversation) => ({
          conversationId: asCleanString((conversation as any).conversationId || (conversation as any).id),
          otherUserId: asCleanString((conversation as any).otherUserId) || null,
          otherUserName: asCleanString((conversation as any).otherUserName) || null,
          otherUserRole: asCleanString((conversation as any).otherUserRole) || null,
          lastMessage: asCleanString((conversation as any).lastMessageContent) || null,
          updatedAt: asCleanString((conversation as any).updatedAt) || null,
          unreadCount: Number((conversation as any).unreadCount || 0),
        }));

      return toTextResult(`Returned ${rows.length} conversations.`, { conversations: rows });
    } catch (error) {
      return toErrorResult(`List conversations failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_get_conversation_messages",
  {
    title: "Get Conversation Messages",
    description: "Fetch messages for a conversation ID or client ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      conversationId: z.string().optional(),
      clientId: z.string().optional(),
      limit: z.number().int().min(1).max(400).default(120),
    },
  },
  async ({ conversationId, clientId, limit }) => {
    try {
      let resolvedConversationId = asCleanString(conversationId);
      if (!resolvedConversationId && clientId) {
        const [profile, clients, conversations] = await Promise.all([
          trpcClient.profile.get.query(),
          trpcClient.clients.list.query(),
          trpcClient.messages.conversations.query(),
        ]);
        const targetClient = (clients as unknown as ClientLite[]).find((client) => client.id === clientId);
        if (!targetClient) {
          return toErrorResult(`Client not found: ${clientId}`);
        }

        const clientUserId = asCleanString(targetClient.userId);
        if (!clientUserId) {
          return toErrorResult(`Client ${clientId} has no linked userId for chat lookup.`);
        }

        const matchedConversation = (conversations as Array<Record<string, unknown>>).find(
          (conversation) => asCleanString((conversation as any).otherUserId) === clientUserId,
        );

        if (matchedConversation) {
          resolvedConversationId = asCleanString(
            (matchedConversation as any).conversationId || (matchedConversation as any).id,
          );
        } else {
          const trainerId = asCleanString((profile as any)?.id);
          resolvedConversationId = trainerId ? toDirectConversationId(trainerId, clientUserId) : "";
        }
      }

      if (!resolvedConversationId) {
        return toErrorResult("conversationId or clientId is required.");
      }

      const thread = (await trpcClient.messages.thread.query({
        conversationId: resolvedConversationId,
      })) as unknown as Array<Record<string, unknown>>;

      const rows = thread.slice(-Math.max(1, limit)).map((message) => ({
        id: asCleanString((message as any).id),
        senderId: asCleanString((message as any).senderId),
        receiverId: asCleanString((message as any).receiverId),
        createdAt: asCleanString((message as any).createdAt),
        content: asCleanString((message as any).content),
        messageType: asCleanString((message as any).messageType) || "text",
      }));

      return toTextResult(`Returned ${rows.length} messages from ${resolvedConversationId}.`, {
        conversationId: resolvedConversationId,
        messages: rows,
      });
    } catch (error) {
      return toErrorResult(`Get conversation messages failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_recommend_bundles_from_chats",
  {
    title: "Recommend Bundles From Chats",
    description: "Deterministically score and recommend best-fit bundles per client based on notes + chat text.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      clientIds: z.array(z.string()).optional(),
      bundleIds: z.array(z.string()).optional(),
      publishedOnly: z.boolean().default(true),
      minScore: z.number().int().min(1).max(50).default(2),
      maxMessagesPerClient: z.number().int().min(10).max(500).default(140),
    },
  },
  async ({ clientIds, bundleIds, publishedOnly, minScore, maxMessagesPerClient }) => {
    try {
      const result = await buildChatBasedBundleRecommendations({
        clientIds,
        bundleIds,
        publishedOnly,
        minScore,
        maxMessagesPerClient,
      });

      const lines = [
        `Recommendations: ${result.recommendations.length} (clients considered: ${result.consideredClients}, bundles considered: ${result.consideredBundles})`,
      ];
      for (const rec of result.recommendations.slice(0, 20)) {
        lines.push(
          `- ${rec.clientName} -> ${rec.bundleTitle} (score=${rec.score}, messages=${rec.messageCount})`,
        );
      }
      if (result.recommendations.length > 20) {
        lines.push(`...and ${result.recommendations.length - 20} more`);
      }
      if (result.skippedClients.length > 0) {
        lines.push(`Skipped clients: ${result.skippedClients.length}`);
      }

      return toTextResult(lines.join("\n"), result);
    } catch (error) {
      return toErrorResult(`Recommendation failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_invite_client",
  {
    title: "Invite One Client",
    description: "Send an invitation email to one client. Requires confirm=true.",
    inputSchema: {
      email: z.string().email(),
      name: z.string().optional(),
      bundleDraftId: z.string().optional(),
      message: z.string().max(1000).optional(),
      confirm: z.boolean().default(false),
    },
  },
  async ({ email, name, bundleDraftId, message, confirm }) => {
    if (!confirm) {
      return toTextResult("Preview only. Set confirm=true to send this invitation.", {
        preview: {
          email,
          name: name || null,
          bundleDraftId: bundleDraftId || null,
          message: message || null,
        },
      });
    }

    try {
      const result = await trpcClient.clients.invite.mutate({
        email,
        name,
        bundleDraftId,
        message,
      });
      return toTextResult(`Invitation sent to ${email}.`, result);
    } catch (error) {
      return toErrorResult(`Invite failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_bulk_invite_clients_to_bundle",
  {
    title: "Bulk Invite Clients To Bundle",
    description: "Bulk send invites to multiple clients for one bundle. Requires confirm=true.",
    inputSchema: {
      bundleDraftId: z.string().describe("Target bundle draft ID."),
      clientIds: z.array(z.string()).optional().describe("Client IDs from trainer_list_clients."),
      message: z.string().max(1000).optional(),
      confirm: z.boolean().default(false),
    },
  },
  async ({ bundleDraftId, clientIds, message, confirm }) => {
    try {
      const clients = (await trpcClient.clients.list.query()) as unknown as ClientLite[];
      const selected = (clientIds?.length
        ? clients.filter((client) => clientIds.includes(client.id))
        : clients
      ).filter((client) => Boolean(asCleanString(client.email)));

      const invitations = selected.map((client) => ({
        email: asCleanString(client.email),
        name: asCleanString(client.name) || undefined,
      }));

      if (!confirm) {
        return toTextResult("Preview only. Set confirm=true to send bulk invites.", {
          bundleDraftId,
          invitationCount: invitations.length,
          invitations,
        });
      }

      if (invitations.length === 0) {
        return toTextResult("No valid client emails found for bulk invite.");
      }

      const result = await trpcClient.clients.bulkInvite.mutate({
        bundleDraftId,
        invitations,
        message,
      });

      return toTextResult(`Bulk invite sent for ${invitations.length} clients.`, result);
    } catch (error) {
      return toErrorResult(`Bulk invite failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_invite_from_chat_recs",
  {
    title: "Invite Clients From Chat Recommendations",
    description:
      "Compute chat-based bundle recommendations and send grouped invites by bundle. Requires confirm=true.",
    inputSchema: {
      clientIds: z.array(z.string()).optional(),
      bundleIds: z.array(z.string()).optional(),
      publishedOnly: z.boolean().default(true),
      minScore: z.number().int().min(1).max(50).default(2),
      maxMessagesPerClient: z.number().int().min(10).max(500).default(140),
      message: z.string().max(1000).optional(),
      confirm: z.boolean().default(false),
    },
  },
  async ({ clientIds, bundleIds, publishedOnly, minScore, maxMessagesPerClient, message, confirm }) => {
    try {
      const recommendationResult = await buildChatBasedBundleRecommendations({
        clientIds,
        bundleIds,
        publishedOnly,
        minScore,
        maxMessagesPerClient,
      });

      const grouped = new Map<string, Array<(typeof recommendationResult.recommendations)[number]>>();
      for (const rec of recommendationResult.recommendations) {
        if (!rec.clientEmail) continue;
        const list = grouped.get(rec.bundleDraftId) || [];
        list.push(rec);
        grouped.set(rec.bundleDraftId, list);
      }

      const preview = {
        recommendationCount: recommendationResult.recommendations.length,
        skippedClients: recommendationResult.skippedClients,
        bundleGroups: Array.from(grouped.entries()).map(([bundleDraftId, recs]) => ({
          bundleDraftId,
          bundleTitle: recs[0]?.bundleTitle || "Bundle",
          invitationCount: recs.length,
          clients: recs.map((rec) => ({
            clientId: rec.clientId,
            clientName: rec.clientName,
            clientEmail: rec.clientEmail,
            score: rec.score,
          })),
        })),
      };

      if (!confirm) {
        return toTextResult(
          `Preview ready: ${preview.recommendationCount} recommendations across ${preview.bundleGroups.length} bundle groups. Set confirm=true to send.`,
          preview,
        );
      }

      const executionResults: Array<{
        bundleDraftId: string;
        bundleTitle: string;
        attempted: number;
        sent: number;
        error?: string;
      }> = [];

      for (const [bundleDraftId, recs] of grouped.entries()) {
        const invitations = recs
          .map((rec) => ({
            email: rec.clientEmail || "",
            name: rec.clientName,
          }))
          .filter((item) => Boolean(item.email));

        if (invitations.length === 0) {
          executionResults.push({
            bundleDraftId,
            bundleTitle: recs[0]?.bundleTitle || "Bundle",
            attempted: 0,
            sent: 0,
            error: "No valid emails in this bundle group.",
          });
          continue;
        }

        try {
          const result = await trpcClient.clients.bulkInvite.mutate({
            bundleDraftId,
            invitations,
            message,
          });
          executionResults.push({
            bundleDraftId,
            bundleTitle: recs[0]?.bundleTitle || "Bundle",
            attempted: invitations.length,
            sent: Number((result as any)?.sent || 0),
          });
        } catch (error) {
          executionResults.push({
            bundleDraftId,
            bundleTitle: recs[0]?.bundleTitle || "Bundle",
            attempted: invitations.length,
            sent: 0,
            error: toErrorMessage(error),
          });
        }
      }

      const totalSent = executionResults.reduce((sum, row) => sum + row.sent, 0);
      return toTextResult(
        `Invite execution complete. Sent ${totalSent} invitations across ${executionResults.length} bundle groups.`,
        {
          preview,
          executionResults,
          totalSent,
        },
      );
    } catch (error) {
      return toErrorResult(`Invite from recommendations failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_client_value_report",
  {
    title: "Client Value Report",
    description: "Build graph-ready client engagement (message count) vs revenue data.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      clientIds: z.array(z.string()).optional(),
      topN: z.number().int().min(1).max(200).default(50),
    },
  },
  async ({ clientIds, topN }) => {
    try {
      const report = await buildClientValueReport({
        clientIds,
        topN,
      });

      const lines = [
        `Report ready for ${report.points.length} clients.`,
        `Totals: messages=${report.totals.totalMessages}, revenue=${report.totals.totalRevenue.toFixed(2)}`,
        "",
        "Top by messages:",
        ...report.sortedByMessages.slice(0, 5).map((row) => `- ${row.clientName}: ${row.messageCount} msgs, ${row.revenue.toFixed(2)} revenue`),
        "",
        "Top by revenue:",
        ...report.sortedByRevenue.slice(0, 5).map((row) => `- ${row.clientName}: ${row.revenue.toFixed(2)} revenue, ${row.messageCount} msgs`),
      ];

      return toTextResult(lines.join("\n"), report);
    } catch (error) {
      return toErrorResult(`Client value report failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_assistant_preview",
  {
    title: "Trainer Assistant Preview",
    description: "Preview trainer automation output through the LLM assistant (no mutations).",
    annotations: {
      readOnlyHint: true,
    },
    inputSchema: {
      message: z.string().min(1).max(4000).describe("Instruction for the trainer assistant."),
      provider: z.enum(["auto", "chatgpt", "claude", "gemini"]).optional(),
      conversationId: z.string().optional(),
    },
  },
  async ({ message, provider, conversationId }) => {
    try {
      const result = await trpcClient.ai.trainerAssistant.mutate({
        message,
        provider,
        allowMutations: false,
        conversationId,
      });
      return toTextResult(formatAssistantResponse(result), result);
    } catch (error) {
      return toErrorResult(`Preview failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_assistant_execute",
  {
    title: "Trainer Assistant Execute",
    description:
      "Execute trainer automation tasks through the LLM assistant (invite flow, planning, analytics). Requires confirm=true.",
    inputSchema: {
      message: z.string().min(1).max(4000).describe("Instruction for the trainer assistant."),
      provider: z.enum(["auto", "chatgpt", "claude", "gemini"]).optional(),
      conversationId: z.string().optional(),
      confirm: z
        .boolean()
        .default(false)
        .describe("Set true only when you want mutation actions to run."),
    },
  },
  async ({ message, provider, conversationId, confirm }) => {
    if (!confirm) {
      return toTextResult("Execution blocked: set confirm=true to allow mutation actions.");
    }

    try {
      const result = await trpcClient.ai.trainerAssistant.mutate({
        message,
        provider,
        allowMutations: true,
        conversationId,
      });
      return toTextResult(formatAssistantResponse(result), result);
    } catch (error) {
      return toErrorResult(`Execution failed: ${toErrorMessage(error)}`);
    }
  },
);

server.registerTool(
  "trainer_voice_transcribe",
  {
    title: "Trainer Voice Transcribe",
    description:
      "Transcribe an uploaded trainer audio URL into text through the app transcription service.",
    annotations: {
      readOnlyHint: true,
    },
    inputSchema: {
      audioUrl: z.string().min(1).describe("Absolute URL (or API-relative URL) for an uploaded audio file."),
      language: z.string().min(2).max(16).optional(),
      prompt: z.string().min(1).max(500).optional(),
    },
  },
  async ({ audioUrl, language, prompt }) => {
    try {
      const result = await trpcClient.voice.transcribe.mutate({
        audioUrl,
        language,
        prompt,
      });
      return toTextResult(result.text || "No transcription text returned.", result);
    } catch (error) {
      return toErrorResult(`Transcription failed: ${toErrorMessage(error)}`);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[MCP] Trainer assistant server connected over stdio (${trpcUrl})`);
}

main().catch((error) => {
  console.error("[MCP] Server error:", error);
  process.exit(1);
});
