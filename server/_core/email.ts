import { Resend } from "resend";
import { ENV } from "./env";

export type InviteEmailErrorCode =
  | "INVITE_EMAIL_CONFIG_MISSING"
  | "INVITE_EMAIL_DOMAIN_NOT_VERIFIED"
  | "INVITE_EMAIL_TEST_MODE_RESTRICTED"
  | "INVITE_EMAIL_RATE_LIMITED"
  | "INVITE_EMAIL_PROVIDER_ERROR";

export class InviteEmailError extends Error {
  code: InviteEmailErrorCode;
  constructor(code: InviteEmailErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type InviteEmailInput = {
  to: string;
  token: string;
  recipientName?: string | null;
  trainerName?: string | null;
  expiresAtIso: string;
  personalMessage?: string | null;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getInviteBaseUrl(): string {
  const candidate = ENV.publicAppUrl || ENV.expoPublicAppUrl || ENV.expoPublicApiBaseUrl || "";
  return candidate ? trimTrailingSlash(candidate) : "";
}

function getInviteLink(token: string): string {
  const tokenParam = encodeURIComponent(token);
  const path = `/register?inviteToken=${tokenParam}`;
  const base = getInviteBaseUrl();
  if (base) return `${base}${path}`;
  return `locomotivate://register?inviteToken=${tokenParam}`;
}

function buildInviteHtml(input: InviteEmailInput, inviteLink: string): string {
  const recipient = input.recipientName?.trim() || "there";
  const trainer = input.trainerName?.trim() || "your trainer";
  const expiresOn = new Date(input.expiresAtIso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const personalMessage = input.personalMessage?.trim() || "";
  const messageBlock = personalMessage
    ? `
    <div style="margin:0 0 16px;padding:12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
      <p style="margin:0;font-size:14px;color:#334155;"><strong>Message from ${escapeHtml(trainer)}:</strong></p>
      <p style="margin:8px 0 0;font-size:14px;color:#0f172a;white-space:pre-wrap;">${escapeHtml(personalMessage)}</p>
    </div>
    `
    : "";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:18px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;">
    <h2 style="margin:0 0 12px;">You are invited to Bright Coach</h2>
    <p style="margin:0 0 12px;">Hi ${escapeHtml(recipient)},</p>
    <p style="margin:0 0 16px;">${escapeHtml(trainer)} has invited you to join them on Bright Coach.</p>
    ${messageBlock}
    <p style="margin:0 0 20px;">
      <a href="${inviteLink}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">
        Accept invitation
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">This invitation expires on ${escapeHtml(expiresOn)}.</p>
    <p style="margin:0;font-size:13px;color:#64748b;">If the button doesn't work, copy and paste this URL:</p>
    <p style="margin:6px 0 0;font-size:13px;word-break:break-all;">
      <a href="${inviteLink}" style="color:#2563eb;">${inviteLink}</a>
    </p>
    </div>
  </div>
  `.trim();
}

function buildInviteText(input: InviteEmailInput, inviteLink: string): string {
  const trainer = input.trainerName?.trim() || "Your trainer";
  const personalMessage = input.personalMessage?.trim() || "";
  const messageSection = personalMessage ? `\n\nMessage from ${trainer}:\n${personalMessage}` : "";
  return `${trainer} invited you to join Bright Coach.

Accept invitation: ${inviteLink}
Invitation expires: ${new Date(input.expiresAtIso).toISOString()}${messageSection}`;
}

export function getInviteEmailFailureUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("domain is not verified")) {
    return "Invite email could not be sent because the sender domain is not verified yet. Verify your domain in Resend and try again.";
  }
  if (normalized.includes("only send testing emails to your own email address")) {
    return "Invite email could not be sent because this Resend account is in test mode. Verify a sender domain to email clients.";
  }
  if (normalized.includes("rate limit")) {
    return "Invite email is temporarily rate limited. Please try again in a minute.";
  }
  if (normalized.includes("resend_api_key") || normalized.includes("resend_from_email")) {
    return "Invite email is not configured on the server yet. Please contact support.";
  }
  return "Invite email could not be sent due to a mail provider issue. You can still share the invite link manually.";
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<string> {
  if (!ENV.resendApiKey) {
    throw new InviteEmailError("INVITE_EMAIL_CONFIG_MISSING", "RESEND_API_KEY is not configured");
  }
  if (!ENV.resendFromEmail) {
    throw new InviteEmailError("INVITE_EMAIL_CONFIG_MISSING", "RESEND_FROM_EMAIL is not configured");
  }

  const resend = new Resend(ENV.resendApiKey);
  const inviteLink = getInviteLink(input.token);
  const html = buildInviteHtml(input, inviteLink);
  const text = buildInviteText(input, inviteLink);

  const { data, error } = await resend.emails.send({
    from: ENV.resendFromEmail,
    to: input.to,
    subject: "You are invited to Bright Coach",
    html,
    text,
  });

  if (error) {
    const normalized = String(error.message || "").toLowerCase();
    if (normalized.includes("domain is not verified")) {
      throw new InviteEmailError("INVITE_EMAIL_DOMAIN_NOT_VERIFIED", `Resend failed: ${error.message}`);
    }
    if (normalized.includes("only send testing emails to your own email address")) {
      throw new InviteEmailError("INVITE_EMAIL_TEST_MODE_RESTRICTED", `Resend failed: ${error.message}`);
    }
    if (normalized.includes("rate limit")) {
      throw new InviteEmailError("INVITE_EMAIL_RATE_LIMITED", `Resend failed: ${error.message}`);
    }
    throw new InviteEmailError("INVITE_EMAIL_PROVIDER_ERROR", `Resend failed: ${error.message}`);
  }

  // Treat missing provider message ID as a failed/indeterminate send.
  if (!data?.id) {
    throw new InviteEmailError(
      "INVITE_EMAIL_PROVIDER_ERROR",
      "Resend failed: provider did not return a message id",
    );
  }

  return data.id;
}
