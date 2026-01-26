import { ENV } from "./env";

export type SmsPayload = {
  to: string; // Phone number in E.164 format (+1234567890)
  message: string;
};

const SMS_MAX_LENGTH = 1600; // Standard SMS concatenation limit

/**
 * Normalize phone number to E.164 format
 * Handles UK (+44) and US (+1) numbers
 */
export function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  
  // Already in E.164 format
  if (cleaned.startsWith("+") && cleaned.length >= 11) {
    return cleaned;
  }
  
  // UK number starting with 0
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return "+44" + cleaned.slice(1);
  }
  
  // US number (10 digits)
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    return "+1" + cleaned;
  }
  
  // UK number without leading 0 (10 digits starting with 7)
  if (cleaned.length === 10 && cleaned.startsWith("7")) {
    return "+44" + cleaned;
  }
  
  console.warn(`[SMS] Could not normalize phone number: ${phone}`);
  return null;
}

/**
 * Send an SMS message via the Manus notification service
 * Falls back gracefully if SMS is not configured
 */
export async function sendSms(payload: SmsPayload): Promise<boolean> {
  const { to, message } = payload;
  
  if (!to || !message) {
    console.warn("[SMS] Missing required fields (to, message)");
    return false;
  }
  
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    console.warn(`[SMS] Invalid phone number: ${to}`);
    return false;
  }
  
  if (message.length > SMS_MAX_LENGTH) {
    console.warn(`[SMS] Message too long (${message.length} chars, max ${SMS_MAX_LENGTH})`);
    return false;
  }
  
  // Use the Manus forge API for SMS if available
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[SMS] Forge API not configured, SMS not sent");
    return false;
  }
  
  try {
    // Build the SMS endpoint URL
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const endpoint = new URL("webdevtoken.v1.WebDevService/SendSms", baseUrl).toString();
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: message,
      }),
    });
    
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[SMS] Failed to send (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
      return false;
    }
    
    console.log(`[SMS] Message sent successfully to ${normalizedPhone}`);
    return true;
  } catch (error) {
    console.warn("[SMS] Error sending SMS:", error);
    return false;
  }
}

/**
 * Send delivery reminder SMS to a trainer
 */
export async function sendDeliveryReminderSms(
  trainerPhone: string,
  trainerName: string,
  productName: string,
  clientName: string,
  scheduledDate: Date
): Promise<boolean> {
  const formattedDate = scheduledDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  
  const message = `Hi ${trainerName.split(" ")[0]}, reminder: You have a product delivery tomorrow (${formattedDate}). Please bring "${productName}" for ${clientName}. - LocoMotivate`;
  
  return sendSms({
    to: trainerPhone,
    message,
  });
}
