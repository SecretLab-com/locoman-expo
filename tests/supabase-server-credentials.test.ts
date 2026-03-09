import { describe, it, expect } from "vitest";

describe("Supabase server credentials validation", () => {
  it("should have SUPABASE_URL set", () => {
    const url = process.env.SUPABASE_URL;
    expect(url).toBeTruthy();
    expect(url).toContain("supabase.co");
  });

  it("should have SUPABASE_SERVICE_ROLE_KEY set", () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(key).toBeTruthy();
    expect(key!.length).toBeGreaterThan(20);
  });

  it("should be able to reach the Supabase API with service role key", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    });
    expect(response.status).toBe(200);
  });
});
