# MCP Customer Journeys

Practical trainer workflows powered by the Locomotivate MCP tools. Each journey maps natural language requests to tool chains that automate real business tasks.

## 1. Morning Business Pulse

**Trigger:** "Give me my daily overview"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `get_context_snapshot` | Client count, bundle count, orders, unread conversations |
| 2 | `list_conversations` | Flag conversations with unread messages |
| 3 | `client_value_report` | Highlight top clients by engagement |

**Output:** "You have 3 unread messages, 2 new orders, and your top client Sarah sent 12 messages this week."

---

## 2. Client Re-engagement Campaign

**Trigger:** "Find clients I haven't talked to in a while and invite them to something"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_clients` (with message counts) | Find clients with low/zero recent messages |
| 2 | `list_bundles` | Get available offers |
| 3 | `recommend_bundles_from_chats` | Match dormant clients to relevant bundles |
| 4 | `invite_from_chat_recs` (preview → confirm) | Send personalized invites |

**Value:** Automates the entire win-back funnel from identification to outreach.

---

## 3. Revenue Opportunity Finder

**Trigger:** "Which clients are engaged but haven't bought anything?"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `client_value_report` | Cross-reference message counts vs revenue |
| 2 | `get_conversation_messages` (for high-engagement, zero-revenue clients) | Understand what they're asking about |
| 3 | `recommend_bundles_from_chats` | Suggest the right bundle to pitch |

**Value:** Turns chat engagement into sales leads.

---

## 4. New Client Onboarding

**Trigger:** "I just signed up a new client, get them started"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_bundles` | Suggest which bundle fits |
| 2 | `invite_client` | Send invitation email with a starter bundle |

**Example:** "Invite sarah@email.com to my starter package" — single voice command handles the entire onboarding.

---

## 5. Conversation Intelligence / Needs Analysis

**Trigger:** "What are my clients asking about this week?"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_conversations` | Get all active conversations |
| 2 | `get_conversation_messages` (for each) | Read recent messages |
| 3 | LLM analysis | Summarize common themes, questions, complaints, requests |
| 4 | `recommend_bundles_from_chats` | Match expressed needs to bundles |

**Output:** "3 clients asked about nutrition plans. You have a 'Meal Prep Bundle' that matches — want to invite them?"

---

## 6. Bulk Bundle Launch

**Trigger:** "I created a new bundle, invite all my active clients"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_bundles` | Find the new/recently published bundle |
| 2 | `list_clients` (status=active) | Get all active clients |
| 3 | `bulk_invite_clients_to_bundle` (preview → confirm) | Send invitations |

**Value:** One command launches a bundle to your entire client base.

---

## 7. Client Progress Check-in

**Trigger:** "How is my client Jason doing?"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_clients` (search=Jason) | Find the client |
| 2 | `get_conversation_messages` (clientId) | Read recent chat history |
| 3 | `client_value_report` | Check engagement + revenue |
| 4 | LLM synthesis | Activity level, discussion topics, purchases |

**Output:** "Jason has sent 28 messages this month, purchased the Strength Bundle, and has been asking about recovery stretches."

---

## 8. End-of-Week Business Report

**Trigger:** "Give me my weekly summary"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `get_context_snapshot` | Current totals |
| 2 | `client_value_report` | Revenue and engagement rankings |
| 3 | `list_conversations` | Message volume and unread count |
| 4 | LLM compilation | Total revenue, most active clients, unanswered messages, growth trends |

**Potential:** Could be scheduled as a weekly automated report.

---

## 9. Smart Upsell from Chat Context

**Trigger:** "Check what my clients need and suggest upgrades"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_clients` (with revenue) | Find clients on lower-tier bundles |
| 2 | `get_conversation_messages` | Read what they've been asking about |
| 3 | `recommend_bundles_from_chats` | Match interests to higher-tier bundles |
| 4 | `invite_from_chat_recs` (preview → confirm) | Send targeted upsell invites |

**Output:** "Maria is on your Basic Plan but has been asking about nutrition coaching. Your Premium Bundle includes nutrition — want to invite her to upgrade?"

---

## 10. Voice-Driven Task Execution

**Trigger:** Trainer speaks into phone between sessions: "Invite john@email.com to my morning bootcamp bundle"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `voice_transcribe` | Convert speech to text |
| 2 | `list_bundles` (search for "bootcamp") | Find the matching bundle |
| 3 | `invite_client` (preview → confirm) | Send invite |

**Value:** Hands-free business management while training clients.

---

## Key Patterns

All workflows follow a common pattern:

```
Gather Context → Analyze → Act
```

The LLM orchestrates tool calls based on natural language. The trainer never needs to know which tools exist — they just describe what they want.

---

## 11. Sponsored Bundle Discovery

**Trigger:** "Show me templates with the best trainer bonuses"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_bundles` (templates) | Browse available templates with `totalTrainerBonus` |
| 2 | LLM ranking | Sort by bonus value, highlight sponsored products |
| 3 | Trainer selects one | Create bundle from template |

**Output:** "The 'Starter Fitness Bundle' has a $12.00 trainer bonus per sale (sponsored by Optimum Nutrition). Want to create a bundle from this template?"

---

## 12. Sponsored Product Revenue Tracker

**Trigger:** "How much have I earned from sponsored product bonuses?"

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `client_value_report` | Get revenue breakdown per client |
| 2 | `list_bundles` | Identify which bundles have sponsored products |
| 3 | LLM analysis | Calculate total bonus earnings, compare to commission |

**Output:** "You've earned $240 in sponsored bonuses this month from Optimum Nutrition products across 20 bundle sales. That's on top of your $1,200 in regular commission."

---

### Highest-Value Journeys

| Journey | Impact |
|---------|--------|
| **#2 Re-engagement** | Directly recovers churning clients |
| **#5 Needs Analysis** | Surfaces sales opportunities from conversations |
| **#6 Bulk Launch** | Maximizes reach for new offers |
| **#9 Smart Upsell** | Increases revenue per client |
| **#11 Sponsored Discovery** | Maximizes trainer bonus income |

### Safety

All mutation workflows (invites, bulk sends) use a **preview → confirm** pattern. The assistant always shows what it will do before executing, and only proceeds after explicit trainer approval.
