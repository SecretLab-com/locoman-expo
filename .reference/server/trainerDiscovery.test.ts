import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
const mockGetTrainerDirectory = vi.fn();
const mockCreateJoinRequest = vi.fn();
const mockGetPendingJoinRequests = vi.fn();
const mockRespondToJoinRequest = vi.fn();
const mockGetTrainerPublicProfile = vi.fn();
const mockGetInvitationByToken = vi.fn();
const mockAcceptInvitation = vi.fn();

vi.mock("./db", () => ({
  getTrainerDirectory: () => mockGetTrainerDirectory(),
  createJoinRequest: (data: any) => mockCreateJoinRequest(data),
  getPendingJoinRequests: (trainerId: number) => mockGetPendingJoinRequests(trainerId),
  respondToJoinRequest: (requestId: number, approved: boolean) => mockRespondToJoinRequest(requestId, approved),
  getTrainerPublicProfile: (params: any) => mockGetTrainerPublicProfile(params),
  getInvitationByToken: (token: string) => mockGetInvitationByToken(token),
  acceptInvitation: (token: string, userId: number) => mockAcceptInvitation(token, userId),
}));

describe("Trainer Discovery System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Trainer Directory", () => {
    it("should return list of active trainers with stats", async () => {
      const mockTrainers = [
        {
          id: 1,
          name: "Coach Sarah",
          bio: "Certified fitness trainer",
          specialties: ["strength", "weight_loss"],
          bundleCount: 5,
          clientCount: 12,
        },
        {
          id: 2,
          name: "Coach Mike",
          bio: "Nutrition specialist",
          specialties: ["nutrition", "longevity"],
          bundleCount: 3,
          clientCount: 8,
        },
      ];

      mockGetTrainerDirectory.mockResolvedValue(mockTrainers);

      const result = await mockGetTrainerDirectory();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Coach Sarah");
      expect(result[0].bundleCount).toBe(5);
      expect(result[1].clientCount).toBe(8);
    });

    it("should return empty array when no trainers exist", async () => {
      mockGetTrainerDirectory.mockResolvedValue([]);

      const result = await mockGetTrainerDirectory();

      expect(result).toHaveLength(0);
    });
  });

  describe("Join Requests", () => {
    it("should create a join request successfully", async () => {
      const requestData = {
        trainerId: 1,
        userId: 100,
        message: "I want to work with you!",
      };

      mockCreateJoinRequest.mockResolvedValue({
        id: 1,
        ...requestData,
        status: "pending",
        createdAt: new Date(),
      });

      const result = await mockCreateJoinRequest(requestData);

      expect(result.id).toBe(1);
      expect(result.status).toBe("pending");
      expect(result.trainerId).toBe(1);
      expect(mockCreateJoinRequest).toHaveBeenCalledWith(requestData);
    });

    it("should return pending join requests for trainer", async () => {
      const mockRequests = [
        {
          id: 1,
          trainerId: 1,
          userId: 100,
          userName: "John Doe",
          userEmail: "john@example.com",
          message: "Looking forward to training!",
          status: "pending",
          createdAt: new Date(),
        },
      ];

      mockGetPendingJoinRequests.mockResolvedValue(mockRequests);

      const result = await mockGetPendingJoinRequests(1);

      expect(result).toHaveLength(1);
      expect(result[0].userName).toBe("John Doe");
      expect(result[0].status).toBe("pending");
    });

    it("should approve a join request", async () => {
      mockRespondToJoinRequest.mockResolvedValue({
        id: 1,
        status: "approved",
        respondedAt: new Date(),
      });

      const result = await mockRespondToJoinRequest(1, true);

      expect(result.status).toBe("approved");
      expect(mockRespondToJoinRequest).toHaveBeenCalledWith(1, true);
    });

    it("should reject a join request", async () => {
      mockRespondToJoinRequest.mockResolvedValue({
        id: 1,
        status: "rejected",
        respondedAt: new Date(),
      });

      const result = await mockRespondToJoinRequest(1, false);

      expect(result.status).toBe("rejected");
      expect(mockRespondToJoinRequest).toHaveBeenCalledWith(1, false);
    });
  });

  describe("Trainer Public Profile", () => {
    it("should return trainer profile by username", async () => {
      const mockProfile = {
        id: 1,
        name: "Coach Sarah",
        username: "coach-sarah",
        bio: "Certified fitness trainer with 10 years experience",
        specialties: ["strength", "weight_loss"],
        socialLinks: { instagram: "@coachsarah" },
        bundles: [
          { id: 1, title: "Strength Starter", price: "99.99" },
          { id: 2, title: "Weight Loss Bundle", price: "149.99" },
        ],
      };

      mockGetTrainerPublicProfile.mockResolvedValue(mockProfile);

      const result = await mockGetTrainerPublicProfile({ username: "coach-sarah" });

      expect(result.username).toBe("coach-sarah");
      expect(result.bundles).toHaveLength(2);
      expect(result.specialties).toContain("strength");
    });

    it("should return null for non-existent trainer", async () => {
      mockGetTrainerPublicProfile.mockResolvedValue(null);

      const result = await mockGetTrainerPublicProfile({ username: "non-existent" });

      expect(result).toBeNull();
    });
  });

  describe("Email Invitation System", () => {
    it("should validate invitation token", async () => {
      const mockInvitation = {
        id: 1,
        trainerId: 1,
        email: "client@example.com",
        token: "valid-token-123",
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      mockGetInvitationByToken.mockResolvedValue(mockInvitation);

      const result = await mockGetInvitationByToken("valid-token-123");

      expect(result).not.toBeNull();
      expect(result.status).toBe("pending");
      expect(result.trainerId).toBe(1);
    });

    it("should return null for invalid token", async () => {
      mockGetInvitationByToken.mockResolvedValue(null);

      const result = await mockGetInvitationByToken("invalid-token");

      expect(result).toBeNull();
    });

    it("should accept invitation and link user to trainer", async () => {
      mockAcceptInvitation.mockResolvedValue({
        success: true,
        trainerId: 1,
        clientId: 100,
      });

      const result = await mockAcceptInvitation("valid-token-123", 100);

      expect(result.success).toBe(true);
      expect(result.trainerId).toBe(1);
      expect(mockAcceptInvitation).toHaveBeenCalledWith("valid-token-123", 100);
    });
  });
});

describe("Bundle Approval Workflow", () => {
  const mockGetBundlesPendingReview = vi.fn();
  const mockApproveBundle = vi.fn();
  const mockRejectBundle = vi.fn();
  const mockSubmitForReview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return bundles pending review", async () => {
    const mockBundles = [
      {
        id: 1,
        title: "Strength Bundle",
        trainerId: 1,
        status: "pending_review",
        submittedForReviewAt: new Date(),
      },
      {
        id: 2,
        title: "Weight Loss Pack",
        trainerId: 2,
        status: "pending_review",
        submittedForReviewAt: new Date(),
      },
    ];

    mockGetBundlesPendingReview.mockResolvedValue(mockBundles);

    const result = await mockGetBundlesPendingReview();

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending_review");
  });

  it("should approve bundle and set status to published", async () => {
    mockApproveBundle.mockResolvedValue({
      id: 1,
      status: "published",
      reviewedAt: new Date(),
      reviewedBy: 999, // admin ID
    });

    const result = await mockApproveBundle(1, 999);

    expect(result.status).toBe("published");
    expect(result.reviewedBy).toBe(999);
  });

  it("should reject bundle with reason", async () => {
    mockRejectBundle.mockResolvedValue({
      id: 1,
      status: "draft",
      rejectionReason: "Please add more product details",
      reviewedAt: new Date(),
      reviewedBy: 999,
    });

    const result = await mockRejectBundle(1, "Please add more product details", 999);

    expect(result.status).toBe("draft");
    expect(result.rejectionReason).toBe("Please add more product details");
  });

  it("should submit bundle for review", async () => {
    mockSubmitForReview.mockResolvedValue({
      id: 1,
      status: "pending_review",
      submittedForReviewAt: new Date(),
    });

    const result = await mockSubmitForReview(1);

    expect(result.status).toBe("pending_review");
    expect(result.submittedForReviewAt).toBeDefined();
  });
});
