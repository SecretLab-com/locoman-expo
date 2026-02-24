import React, { useState } from "react";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export interface MediaItem {
  uri: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  fileName?: string;
}

interface MediaPickerProps {
  images: MediaItem[];
  onImagesChange: (images: MediaItem[]) => void;
  maxImages?: number;
  allowVideo?: boolean;
  aspectRatio?: [number, number];
  quality?: number;
}

/**
 * A component for selecting and managing multiple images/videos.
 * Supports picking from library and taking photos with camera.
 */
export function MediaPicker({
  images,
  onImagesChange,
  maxImages = 10,
  allowVideo = false,
  aspectRatio,
  quality = 0.8,
}: MediaPickerProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const overlaySoft = isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(15, 23, 42, 0.12)";
  const overlayTextColor = isDark ? "#fff" : colors.foreground;
  const [showOptions, setShowOptions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to take photos."
      );
      return false;
    }
    return true;
  };

  // Pick image from library
  const pickFromLibrary = async () => {
    setShowOptions(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: allowVideo
        ? ImagePicker.MediaTypeOptions.All
        : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: aspectRatio,
      quality,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages: MediaItem[] = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName || undefined,
      }));
      onImagesChange([...images, ...newImages].slice(0, maxImages));
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    setShowOptions(false);

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: aspectRatio,
      quality,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const newImage: MediaItem = {
        uri: asset.uri,
        type: "image",
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName || undefined,
      };
      onImagesChange([...images, newImage].slice(0, maxImages));
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
    setSelectedIndex(null);
  };

  // Move image up in order
  const moveImageUp = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    onImagesChange(newImages);
    setSelectedIndex(index - 1);
  };

  // Move image down in order
  const moveImageDown = (index: number) => {
    if (index === images.length - 1) return;
    const newImages = [...images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    onImagesChange(newImages);
    setSelectedIndex(index + 1);
  };

  return (
    <View>
      {/* Image Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3 py-2">
          {/* Add Button */}
          {images.length < maxImages && (
            <TouchableOpacity
              onPress={() => setShowOptions(true)}
              className="w-24 h-24 rounded-xl bg-surface border-2 border-dashed border-border items-center justify-center"
            >
              <IconSymbol name="plus" size={28} color={colors.primary} />
              <Text className="text-xs text-muted mt-1">Add Photo</Text>
            </TouchableOpacity>
          )}

          {/* Image Thumbnails */}
          {images.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setSelectedIndex(index)}
              className="relative"
            >
              <Image
                source={{ uri: image.uri }}
                className="w-24 h-24 rounded-xl"
                resizeMode="cover"
              />
              {image.type === "video" && (
                <View
                  className="absolute inset-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: overlaySoft }}
                >
                  <IconSymbol name="play.fill" size={24} color={overlayTextColor} />
                </View>
              )}
              {index === 0 && (
                <View className="absolute top-1 left-1 bg-primary px-2 py-0.5 rounded">
                  <Text className="text-xs text-white font-semibold">Cover</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error items-center justify-center"
              >
                <IconSymbol name="xmark" size={12} color="white" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Image Count */}
      <Text className="text-xs text-muted mt-2">
        {images.length} of {maxImages} images
      </Text>

      {/* Options Modal */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
          <Pressable
            onPress={() => setShowOptions(false)}
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}
          >
          <SwipeDownSheet
            visible={showOptions}
            onClose={() => setShowOptions(false)}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Add Photo</Text>

            <TouchableOpacity
              onPress={takePhoto}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                <IconSymbol name="camera.fill" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Take Photo</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>Use your camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickFromLibrary}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                <IconSymbol name="photo" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Choose from Library</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>Select from your photos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowOptions(false)} style={{ paddingVertical: 16, marginTop: 16 }}>
              <Text style={{ textAlign: "center", color: colors.muted, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </SwipeDownSheet>
        </Pressable>
      </Modal>

      {/* Image Detail Modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
          <Pressable
            onPress={() => setSelectedIndex(null)}
            style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.85)" }}
          >
          {selectedIndex !== null && images[selectedIndex] && (
            <View className="w-full">
              <Image
                source={{ uri: images[selectedIndex].uri }}
                className="w-full aspect-square"
                resizeMode="contain"
              />
              <View className="flex-row justify-center gap-4 mt-8">
                <TouchableOpacity
                  onPress={() => moveImageUp(selectedIndex)}
                  disabled={selectedIndex === 0}
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: selectedIndex === 0
                      ? (isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)")
                      : (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(15, 23, 42, 0.35)"),
                  }}
                >
                  <IconSymbol name="chevron.left" size={24} color={overlayTextColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeImage(selectedIndex)}
                  className="w-12 h-12 rounded-full bg-error items-center justify-center"
                >
                  <IconSymbol name="trash.fill" size={24} color={overlayTextColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveImageDown(selectedIndex)}
                  disabled={selectedIndex === images.length - 1}
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: selectedIndex === images.length - 1
                      ? (isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)")
                      : (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(15, 23, 42, 0.35)"),
                  }}
                >
                  <IconSymbol name="chevron.right" size={24} color={overlayTextColor} />
                </TouchableOpacity>
              </View>
              <Text className="text-center mt-4" style={{ color: overlayTextColor }}>
                {selectedIndex + 1} of {images.length}
              </Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * A simpler single image picker component.
 */
export function SingleImagePicker({
  image,
  onImageChange,
  aspectRatio,
  quality = 0.8,
  placeholder = "Add Image",
}: {
  image: string | null;
  onImageChange: (uri: string | null) => void;
  aspectRatio?: [number, number];
  quality?: number;
  placeholder?: string;
}) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const overlaySoft = isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(15, 23, 42, 0.12)";
  const overlayStrong = isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(15, 23, 42, 0.2)";
  const overlayTextColor = isDark ? "#fff" : colors.foreground;
  const [showOptions, setShowOptions] = useState(false);

  const pickFromLibrary = async () => {
    setShowOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: aspectRatio,
      quality,
    });

    if (!result.canceled && result.assets.length > 0) {
      onImageChange(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    setShowOptions(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: aspectRatio,
      quality,
    });

    if (!result.canceled && result.assets.length > 0) {
      onImageChange(result.assets[0].uri);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => (image ? onImageChange(null) : setShowOptions(true))}
        className="w-full aspect-video rounded-xl bg-surface border border-border overflow-hidden"
      >
        {image ? (
          <View className="relative w-full h-full">
            <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
            <View className="absolute top-2 right-2">
              <TouchableOpacity
                onPress={() => onImageChange(null)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: overlaySoft }}
              >
                <IconSymbol name="xmark" size={16} color={overlayTextColor} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setShowOptions(true)}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: overlayStrong }}
            >
              <Text className="text-sm" style={{ color: overlayTextColor }}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <IconSymbol name="photo" size={32} color={colors.muted} />
            <Text className="text-muted mt-2 text-xs text-center">{placeholder}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable
          onPress={() => setShowOptions(false)}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}
        >
          <SwipeDownSheet
            visible={showOptions}
            onClose={() => setShowOptions(false)}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}
          >
            <TouchableOpacity
              onPress={takePhoto}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <IconSymbol name="camera.fill" size={24} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontWeight: "600", marginLeft: 16, fontSize: 16 }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromLibrary}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16 }}
            >
              <IconSymbol name="photo" size={24} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontWeight: "600", marginLeft: 16, fontSize: 16 }}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowOptions(false)} style={{ paddingVertical: 16, marginTop: 8 }}>
              <Text style={{ textAlign: "center", color: colors.muted, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </SwipeDownSheet>
        </Pressable>
      </Modal>
    </View>
  );
}
