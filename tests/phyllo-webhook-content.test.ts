import { describe, expect, it } from "vitest";
import { extractPhylloContentRows } from "../server/_core/phyllo-webhook";

describe("extractPhylloContentRows", () => {
  it("maps content rows with permalink and engagement metrics", () => {
    const rows = extractPhylloContentRows({
      contents: [
        {
          id: "content_1",
          platform: "youtube",
          permalink: "https://youtube.com/watch?v=abc",
          profile_url: "https://youtube.com/@creator",
          caption: "New workout video",
          published_at: "2026-03-01T12:00:00.000Z",
          stats: {
            views: 1200,
            likes: 200,
            comments: 20,
            engagements: 240,
          },
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].phylloContentId).toBe("content_1");
    expect(rows[0].postUrl).toBe("https://youtube.com/watch?v=abc");
    expect(rows[0].profileUrl).toBe("https://youtube.com/@creator");
    expect(rows[0].engagements).toBe(240);
  });

  it("keeps profile fallback when post url is missing", () => {
    const rows = extractPhylloContentRows({
      data: {
        id: "content_2",
        platform_name: "instagram",
        profile_url: "https://instagram.com/example",
        description: "Story update",
        metrics: {
          likes: 10,
          comments: 2,
        },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].postUrl).toBe(null);
    expect(rows[0].profileUrl).toBe("https://instagram.com/example");
    expect(rows[0].engagements).toBe(12);
  });
});
