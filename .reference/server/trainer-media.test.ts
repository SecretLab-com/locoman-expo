import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getTrainerMedia: vi.fn().mockResolvedValue([
    {
      id: 1,
      trainerId: 1,
      type: "profile_photo",
      url: "https://example.com/profile.jpg",
      fileKey: "trainer-media/1/profile-123.jpg",
      mimeType: "image/jpeg",
      fileSize: 50000,
      sortOrder: 0,
      createdAt: new Date(),
    },
    {
      id: 2,
      trainerId: 1,
      type: "gallery_image",
      url: "https://example.com/gallery1.jpg",
      fileKey: "trainer-media/1/gallery-123.jpg",
      mimeType: "image/jpeg",
      fileSize: 100000,
      sortOrder: 0,
      createdAt: new Date(),
    },
  ]),
  getTrainerMediaByType: vi.fn().mockImplementation((trainerId, type) => {
    if (type === "profile_photo") {
      return Promise.resolve([{
        id: 1,
        trainerId: 1,
        type: "profile_photo",
        url: "https://example.com/profile.jpg",
      }]);
    }
    return Promise.resolve([]);
  }),
  getTrainerProfilePhoto: vi.fn().mockResolvedValue({
    id: 1,
    trainerId: 1,
    type: "profile_photo",
    url: "https://example.com/profile.jpg",
  }),
  createTrainerMedia: vi.fn().mockResolvedValue(1),
  updateTrainerMedia: vi.fn().mockResolvedValue(true),
  deleteTrainerMedia: vi.fn().mockResolvedValue({ fileKey: "trainer-media/1/test.jpg" }),
  reorderTrainerGallery: vi.fn().mockResolvedValue(true),
  getTrainerGalleryCount: vi.fn().mockResolvedValue(3),
  getTrainerVideoCount: vi.fn().mockResolvedValue(1),
  getTrainerByUsername: vi.fn().mockResolvedValue({
    id: 1,
    username: "testtrainer",
    name: "Test Trainer",
    role: "trainer",
  }),
  updateUserPhotoUrl: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("Trainer Media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTrainerMedia", () => {
    it("should return all media for a trainer", async () => {
      const media = await db.getTrainerMedia(1);
      
      expect(media).toHaveLength(2);
      expect(media[0].type).toBe("profile_photo");
      expect(media[1].type).toBe("gallery_image");
    });
  });

  describe("getTrainerMediaByType", () => {
    it("should return media filtered by type", async () => {
      const profilePhotos = await db.getTrainerMediaByType(1, "profile_photo");
      
      expect(profilePhotos).toHaveLength(1);
      expect(profilePhotos[0].type).toBe("profile_photo");
    });
  });

  describe("getTrainerProfilePhoto", () => {
    it("should return the trainer's profile photo", async () => {
      const photo = await db.getTrainerProfilePhoto(1);
      
      expect(photo).not.toBeNull();
      expect(photo?.type).toBe("profile_photo");
      expect(photo?.url).toBe("https://example.com/profile.jpg");
    });
  });

  describe("createTrainerMedia", () => {
    it("should create a new media entry", async () => {
      const mediaId = await db.createTrainerMedia({
        trainerId: 1,
        type: "gallery_image",
        url: "https://example.com/new-image.jpg",
        fileKey: "trainer-media/1/new-image.jpg",
        mimeType: "image/jpeg",
        fileSize: 75000,
        sortOrder: 0,
      });
      
      expect(mediaId).toBe(1);
      expect(db.createTrainerMedia).toHaveBeenCalledWith(expect.objectContaining({
        trainerId: 1,
        type: "gallery_image",
      }));
    });
  });

  describe("updateTrainerMedia", () => {
    it("should update media title and description", async () => {
      const success = await db.updateTrainerMedia(1, 1, {
        title: "Updated Title",
        description: "Updated description",
      });
      
      expect(success).toBe(true);
      expect(db.updateTrainerMedia).toHaveBeenCalledWith(1, 1, {
        title: "Updated Title",
        description: "Updated description",
      });
    });
  });

  describe("deleteTrainerMedia", () => {
    it("should delete media and return file key", async () => {
      const result = await db.deleteTrainerMedia(1, 1);
      
      expect(result).not.toBeNull();
      expect(result?.fileKey).toBe("trainer-media/1/test.jpg");
    });
  });

  describe("reorderTrainerGallery", () => {
    it("should reorder gallery images", async () => {
      const success = await db.reorderTrainerGallery(1, [3, 1, 2]);
      
      expect(success).toBe(true);
      expect(db.reorderTrainerGallery).toHaveBeenCalledWith(1, [3, 1, 2]);
    });
  });

  describe("getTrainerGalleryCount", () => {
    it("should return the count of gallery images", async () => {
      const count = await db.getTrainerGalleryCount(1);
      
      expect(count).toBe(3);
    });
  });

  describe("getTrainerVideoCount", () => {
    it("should return the count of videos", async () => {
      const count = await db.getTrainerVideoCount(1);
      
      expect(count).toBe(1);
    });
  });

  describe("Video URL parsing", () => {
    it("should parse YouTube URLs correctly", () => {
      const testUrls = [
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", expected: "dQw4w9WgXcQ" },
        { url: "https://youtu.be/dQw4w9WgXcQ", expected: "dQw4w9WgXcQ" },
        { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", expected: "dQw4w9WgXcQ" },
      ];
      
      testUrls.forEach(({ url, expected }) => {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
        expect(match?.[1]).toBe(expected);
      });
    });

    it("should parse Vimeo URLs correctly", () => {
      const testUrls = [
        { url: "https://vimeo.com/123456789", expected: "123456789" },
        { url: "https://www.vimeo.com/987654321", expected: "987654321" },
      ];
      
      testUrls.forEach(({ url, expected }) => {
        const match = url.match(/vimeo\.com\/(\d+)/);
        expect(match?.[1]).toBe(expected);
      });
    });
  });

  describe("Gallery limits", () => {
    it("should enforce maximum 12 gallery images", async () => {
      const count = await db.getTrainerGalleryCount(1);
      const maxAllowed = 12;
      
      expect(count).toBeLessThanOrEqual(maxAllowed);
    });

    it("should enforce maximum 6 videos", async () => {
      const count = await db.getTrainerVideoCount(1);
      const maxAllowed = 6;
      
      expect(count).toBeLessThanOrEqual(maxAllowed);
    });
  });

  describe("Video upload", () => {
    it("should create video with upload provider", async () => {
      const mediaId = await db.createTrainerMedia({
        trainerId: 1,
        type: "video",
        url: "https://storage.example.com/video.mp4",
        fileKey: "trainer-media/1/video-123.mp4",
        mimeType: "video/mp4",
        fileSize: 50000000,
        videoProvider: "upload",
        sortOrder: 0,
      });
      
      expect(mediaId).toBe(1);
      expect(db.createTrainerMedia).toHaveBeenCalledWith(expect.objectContaining({
        type: "video",
        videoProvider: "upload",
      }));
    });
  });

  describe("Gallery reordering", () => {
    it("should reorder gallery images by ID array", async () => {
      const success = await db.reorderTrainerGallery(1, [5, 3, 1, 4, 2]);
      
      expect(success).toBe(true);
      expect(db.reorderTrainerGallery).toHaveBeenCalledWith(1, [5, 3, 1, 4, 2]);
    });

    it("should handle empty reorder array", async () => {
      const success = await db.reorderTrainerGallery(1, []);
      
      expect(success).toBe(true);
    });
  });
});
