import { describe, it, expect } from "vitest";

describe("Supabase credentials validation", () => {
  it("should have EXPO_PUBLIC_SUPABASE_URL set", () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    expect(url).toBeTruthy();
    expect(url).toContain("supabase.co");
  });

  it("should have EXPO_PUBLIC_SUPABASE_KEY set", () => {
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
    expect(key).toBeTruthy();
    expect(key!.length).toBeGreaterThan(20);
  });

  it("should be able to reach the Supabase API", async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    });
    // 200 means we can reach the API and the key is valid
    expect(response.status).toBe(200);
  });
});
