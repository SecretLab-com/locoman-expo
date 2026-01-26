import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Manager Users Screen Enhancements", () => {
  const usersScreenPath = path.join(__dirname, "../app/(manager)/users.tsx");
  let usersScreenContent: string;

  beforeAll(() => {
    usersScreenContent = fs.readFileSync(usersScreenPath, "utf-8");
  });

  describe("User Detail Modal", () => {
    it("should have Modal component imported", () => {
      expect(usersScreenContent).toContain("Modal");
    });

    it("should have modal state management", () => {
      expect(usersScreenContent).toContain("modalVisible");
      expect(usersScreenContent).toContain("setModalVisible");
      expect(usersScreenContent).toContain("selectedUser");
      expect(usersScreenContent).toContain("setSelectedUser");
    });

    it("should have openUserDetail function", () => {
      expect(usersScreenContent).toContain("openUserDetail");
    });

    it("should have closeModal function", () => {
      expect(usersScreenContent).toContain("closeModal");
    });

    it("should display user profile in modal", () => {
      expect(usersScreenContent).toContain("User Details");
      expect(usersScreenContent).toContain("selectedUser.name");
      expect(usersScreenContent).toContain("selectedUser.email");
    });

    it("should show user status in modal", () => {
      expect(usersScreenContent).toContain("selectedUser.status");
    });

    it("should show last active time", () => {
      expect(usersScreenContent).toContain("lastActive");
      expect(usersScreenContent).toContain("formatRelativeTime");
    });
  });

  describe("Role Change Action", () => {
    it("should have changeUserRole function", () => {
      expect(usersScreenContent).toContain("changeUserRole");
    });

    it("should have role selection UI", () => {
      expect(usersScreenContent).toContain("Change Role");
      expect(usersScreenContent).toContain("roleGrid");
      expect(usersScreenContent).toContain("roleOption");
    });

    it("should update user role in state", () => {
      expect(usersScreenContent).toContain("setUsers");
      expect(usersScreenContent).toContain("role: newRole");
    });

    it("should show success alert after role change", () => {
      expect(usersScreenContent).toContain("role changed to");
    });
  });

  describe("Activate/Deactivate User", () => {
    it("should have toggleUserStatus function", () => {
      expect(usersScreenContent).toContain("toggleUserStatus");
    });

    it("should have status toggle button", () => {
      expect(usersScreenContent).toContain("Deactivate User");
      expect(usersScreenContent).toContain("Activate User");
    });

    it("should show inactive badge for inactive users", () => {
      expect(usersScreenContent).toContain("Inactive");
      expect(usersScreenContent).toContain("STATUS_COLORS");
    });

    it("should update user status in state", () => {
      expect(usersScreenContent).toContain("status: newStatus");
    });
  });

  describe("Pagination/Infinite Scroll", () => {
    it("should have PAGE_SIZE constant", () => {
      expect(usersScreenContent).toContain("PAGE_SIZE");
    });

    it("should have displayCount state", () => {
      expect(usersScreenContent).toContain("displayCount");
      expect(usersScreenContent).toContain("setDisplayCount");
    });

    it("should have loadMore function", () => {
      expect(usersScreenContent).toContain("loadMore");
    });

    it("should have loadingMore state", () => {
      expect(usersScreenContent).toContain("loadingMore");
      expect(usersScreenContent).toContain("setLoadingMore");
    });

    it("should have hasMore computed value", () => {
      expect(usersScreenContent).toContain("hasMore");
    });

    it("should have displayedUsers computed value", () => {
      expect(usersScreenContent).toContain("displayedUsers");
    });

    it("should handle scroll event for infinite scroll", () => {
      expect(usersScreenContent).toContain("onScroll");
      expect(usersScreenContent).toContain("isCloseToBottom");
    });

    it("should show loading indicator when loading more", () => {
      expect(usersScreenContent).toContain("Loading more");
      expect(usersScreenContent).toContain("ActivityIndicator");
    });

    it("should show end of list message", () => {
      expect(usersScreenContent).toContain("Showing all");
    });
  });

  describe("CSV Export", () => {
    it("should import FileSystem", () => {
      expect(usersScreenContent).toContain("expo-file-system");
    });

    it("should import Sharing", () => {
      expect(usersScreenContent).toContain("expo-sharing");
    });

    it("should have exportToCSV function", () => {
      expect(usersScreenContent).toContain("exportToCSV");
    });

    it("should have exporting state", () => {
      expect(usersScreenContent).toContain("exporting");
      expect(usersScreenContent).toContain("setExporting");
    });

    it("should have Export button", () => {
      expect(usersScreenContent).toContain("exportButton");
      expect(usersScreenContent).toContain("Export");
    });

    it("should create CSV headers", () => {
      expect(usersScreenContent).toContain("headers");
      expect(usersScreenContent).toContain("ID");
      expect(usersScreenContent).toContain("Name");
      expect(usersScreenContent).toContain("Email");
      expect(usersScreenContent).toContain("Role");
      expect(usersScreenContent).toContain("Status");
    });

    it("should create CSV content", () => {
      expect(usersScreenContent).toContain("csvContent");
      expect(usersScreenContent).toContain(".join");
    });

    it("should handle web export with Blob", () => {
      expect(usersScreenContent).toContain("Blob");
      expect(usersScreenContent).toContain("createObjectURL");
    });

    it("should handle native export with FileSystem and Sharing", () => {
      expect(usersScreenContent).toContain("FileSystem.documentDirectory");
      expect(usersScreenContent).toContain("FileSystem.writeAsStringAsync");
      expect(usersScreenContent).toContain("Sharing.shareAsync");
    });

    it("should show success alert after export", () => {
      expect(usersScreenContent).toContain("CSV file downloaded");
    });
  });

  describe("Haptic Feedback", () => {
    it("should import Haptics", () => {
      expect(usersScreenContent).toContain("expo-haptics");
    });

    it("should use haptic feedback on user detail open", () => {
      expect(usersScreenContent).toContain("Haptics.impactAsync");
    });

    it("should use haptic feedback on role change", () => {
      expect(usersScreenContent).toContain("Haptics.notificationAsync");
    });

    it("should check platform before haptics", () => {
      expect(usersScreenContent).toContain('Platform.OS !== "web"');
    });
  });

  describe("Extended Mock Data", () => {
    it("should have more than 6 mock users for pagination demo", () => {
      expect(usersScreenContent).toContain("generateMockUsers");
      // Check that there are at least 10 users in the mock data
      const userMatches = usersScreenContent.match(/id: \d+, name:/g);
      expect(userMatches).not.toBeNull();
      expect(userMatches!.length).toBeGreaterThanOrEqual(10);
    });

    it("should have phone field in user type", () => {
      expect(usersScreenContent).toContain("phone?:");
    });

    it("should have lastActive field in user type", () => {
      expect(usersScreenContent).toContain("lastActive?:");
    });

    it("should have status field in user type", () => {
      expect(usersScreenContent).toContain('status: UserStatus');
    });
  });
});
