import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

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
                <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-xl">
                  <IconSymbol name="play.fill" size={24} color="white" />
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
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowOptions(false)}
        >
          <View className="bg-background rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-foreground mb-4">Add Photo</Text>

            <TouchableOpacity
              onPress={takePhoto}
              className="flex-row items-center py-4 border-b border-border"
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
                <IconSymbol name="camera.fill" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-foreground font-semibold">Take Photo</Text>
                <Text className="text-sm text-muted">Use your camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickFromLibrary}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
                <IconSymbol name="photo" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-foreground font-semibold">Choose from Library</Text>
                <Text className="text-sm text-muted">Select from your photos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowOptions(false)}
              className="py-4 mt-4"
            >
              <Text className="text-center text-muted">Cancel</Text>
            </TouchableOpacity>
          </View>
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
          className="flex-1 bg-black/90 justify-center items-center"
          onPress={() => setSelectedIndex(null)}
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
                  className={`w-12 h-12 rounded-full items-center justify-center ${
                    selectedIndex === 0 ? "bg-white/20" : "bg-white/40"
                  }`}
                >
                  <IconSymbol name="chevron.left" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeImage(selectedIndex)}
                  className="w-12 h-12 rounded-full bg-error items-center justify-center"
                >
                  <IconSymbol name="trash.fill" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveImageDown(selectedIndex)}
                  disabled={selectedIndex === images.length - 1}
                  className={`w-12 h-12 rounded-full items-center justify-center ${
                    selectedIndex === images.length - 1 ? "bg-white/20" : "bg-white/40"
                  }`}
                >
                  <IconSymbol name="chevron.right" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <Text className="text-white text-center mt-4">
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
                className="w-8 h-8 rounded-full bg-black/50 items-center justify-center"
              >
                <IconSymbol name="xmark" size={16} color="white" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setShowOptions(true)}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/50"
            >
              <Text className="text-white text-sm">Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="photo" size={40} color={colors.muted} />
            <Text className="text-muted mt-2">{placeholder}</Text>
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
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowOptions(false)}
        >
          <View className="bg-background rounded-t-3xl p-6">
            <TouchableOpacity
              onPress={takePhoto}
              className="flex-row items-center py-4 border-b border-border"
            >
              <IconSymbol name="camera.fill" size={24} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-4">Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromLibrary}
              className="flex-row items-center py-4"
            >
              <IconSymbol name="photo" size={24} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-4">Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowOptions(false)} className="py-4 mt-2">
              <Text className="text-center text-muted">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
