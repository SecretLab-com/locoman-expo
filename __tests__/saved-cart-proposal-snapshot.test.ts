import { describe, expect, it } from "vitest";

import { buildSavedCartProposalSnapshot } from "../shared/saved-cart-proposal";

describe("buildSavedCartProposalSnapshot", () => {
  it("uses programWeeks × sessionsPerWeek for projected session count when set", () => {
    const snapshot = buildSavedCartProposalSnapshot({
      title: "Test",
      startDate: "2025-01-06T00:00:00.000Z",
      cadenceCode: "weekly",
      sessionsPerWeek: 2,
      programWeeks: 8,
      sessionDurationMinutes: 60,
      items: [
        {
          itemType: "bundle",
          title: "Base",
          bundleDraftId: "b1",
          quantity: 1,
          unitPrice: 100,
          fulfillmentMethod: "trainer_delivery",
          metadata: {
            cadence: "weekly",
            includedProducts: [],
            includedServices: [],
            includedGoals: [],
          },
        },
      ],
    });

    expect(snapshot.programWeeks).toBe(8);
    expect(snapshot.sessionsPerWeek).toBe(2);
    expect(snapshot.projectedSchedule.length).toBe(16);
  });
});
