import { describe, expect, it } from "vitest";
import {
  normalizePhylloWebhookEvents,
  verifyPhylloWebhookSignature,
} from "../server/_core/phyllo";
import { createHmac } from "crypto";

describe("phyllo webhook helpers", () => {
  it("normalizes envelope arrays and key fields", () => {
    const payload = {
      events: [
        {
          id: "evt_1",
          event_type: "ACCOUNTS.CONNECTED",
          user_id: "phy_user_1",
          account_id: "acc_1",
          created_at: "2026-02-22T12:00:00.000Z",
        },
      ],
    };
    const rows = normalizePhylloWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].providerEventId).toBe("evt_1");
    expect(rows[0].eventType).toBe("accounts.connected");
    expect(rows[0].phylloUserId).toBe("phy_user_1");
    expect(rows[0].phylloAccountId).toBe("acc_1");
  });

  it("verifies hmac signature with and without sha256 prefix", () => {
    const raw = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    const secret = "test_secret";
    const digest = createHmac("sha256", secret).update(raw).digest("hex");
    expect(
      verifyPhylloWebhookSignature({
        rawBody: raw,
        signatureHeader: digest,
        secret,
      }),
    ).toBe(true);
    expect(
      verifyPhylloWebhookSignature({
        rawBody: raw,
        signatureHeader: `sha256=${digest}`,
        secret,
      }),
    ).toBe(true);
  });
});
