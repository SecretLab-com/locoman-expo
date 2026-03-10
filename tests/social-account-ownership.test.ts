import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  getUserById: vi.fn(),
  listOtherTrainerSocialProfiles: vi.fn(),
  getUserIdsByRoles: vi.fn(),
  listSocialEventNotificationsForUser: vi.fn(),
  createSocialEventNotification: vi.fn(),
}));

import * as db from "../server/db";
import {
  extractTrainerSocialIdentities,
  findTrainerSocialIdentityConflict,
  formatTrainerSocialIdentityConflictMessage,
  notifyTrainerSocialIdentityConflict,
} from "../server/_core/social-account-ownership";

describe("social account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts platform usernames and urls from phyllo account rows", () => {
    const identities = extractTrainerSocialIdentities({
      phylloUserId: "user_123",
      phylloAccountIds: ["acct_123"],
      accounts: [
        {
          id: "acct_123",
          platform_username: "primplink@gmail.com",
          username: "PrimpLink",
          profile_url: "https://youtube.com/@PrimpLink/",
          work_platform: { name: "YouTube" },
        },
      ],
    });

    expect(
      identities.some(
        (identity) =>
          identity.platform === "youtube" &&
          identity.identityType === "platform_username" &&
          identity.normalizedValue === "primplink@gmail.com",
      ),
    ).toBe(true);
    expect(
      identities.some(
        (identity) =>
          identity.platform === "youtube" &&
          identity.identityType === "profile_url" &&
          identity.normalizedValue === "youtube.com/@primplink",
      ),
    ).toBe(true);
    expect(
      identities.some(
        (identity) =>
          identity.platform === "global" &&
          identity.identityType === "phyllo_user_id" &&
          identity.normalizedValue === "user_123",
      ),
    ).toBe(true);
  });

  it("detects when the same platform account is already owned by another trainer", async () => {
    vi.mocked(db.listOtherTrainerSocialProfiles).mockResolvedValue([
      {
        id: "profile_1",
        trainerId: "trainer_1",
        phylloUserId: "user_1",
        phylloAccountIds: ["acct_existing"],
        platforms: ["youtube"],
        followerCount: 0,
        avgViewsPerMonth: 0,
        avgEngagementRate: 0,
        avgCtr: 0,
        metadata: {
          rawProfiles: [],
          rawAccounts: [
            {
              id: "acct_existing",
              platform_username: "primplink@gmail.com",
              profile_url: "https://youtube.com/@PrimpLink",
              work_platform: { name: "YouTube" },
            },
          ],
        },
        lastSyncedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    ]);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: "trainer_1",
      name: "Trainer One",
      email: "trainer1@secretlab.com",
    } as any);

    const conflict = await findTrainerSocialIdentityConflict({
      trainerId: "trainer_2",
      phylloUserId: "user_2",
      accounts: [
        {
          id: "acct_new",
          platform_username: "primplink@gmail.com",
          work_platform: { name: "YouTube" },
        },
      ],
    });

    expect(conflict).not.toBeNull();
    expect(conflict?.conflictingTrainerId).toBe("trainer_1");
    expect(conflict?.incoming.platform).toBe("youtube");
    expect(conflict?.incoming.identityType).toBe("platform_username");
    expect(formatTrainerSocialIdentityConflictMessage(conflict!)).toContain(
      "already connected to Trainer One",
    );
  });

  it("creates a manager audit notification for account conflicts", async () => {
    vi.mocked(db.getUserIdsByRoles).mockResolvedValue(["manager_1"]);
    vi.mocked(db.listSocialEventNotificationsForUser).mockResolvedValue([]);
    vi.mocked(db.createSocialEventNotification).mockResolvedValue({
      id: "notif_1",
    } as any);

    await notifyTrainerSocialIdentityConflict({
      trainerId: "trainer_2",
      source: "connect_phyllo",
      conflict: {
        conflictingTrainerId: "trainer_1",
        conflictingTrainerName: "Trainer One",
        conflictingTrainerEmail: "trainer1@secretlab.com",
        incoming: {
          platform: "youtube",
          identityType: "platform_username",
          rawValue: "primplink@gmail.com",
          normalizedValue: "primplink@gmail.com",
        },
        existing: {
          platform: "youtube",
          identityType: "platform_username",
          rawValue: "primplink@gmail.com",
          normalizedValue: "primplink@gmail.com",
        },
      },
    });

    expect(db.createSocialEventNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "manager_1",
        trainerId: "trainer_2",
        severity: "warning",
        title: "Duplicate social account blocked",
        metadata: expect.objectContaining({
          eventType: "social_program.account_conflict",
          source: "connect_phyllo",
          platform: "youtube",
          identityValue: "primplink@gmail.com",
        }),
      }),
    );
  });
});
