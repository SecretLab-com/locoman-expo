import React, { useState } from 'react';
import { Modal, Dimensions, Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Image } from 'tamagui';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from '@tamagui/lucide-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Button } from './ui/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, visible, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransform = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetTransform();
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetTransform();
    }
  };

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access media library is required!');
        return;
      }

      const imageUrl = images[currentIndex];
      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const fileUri = FileSystem.documentDirectory + filename;

      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
      alert('Image saved to gallery!');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download image');
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const zoomIn = () => {
    const newScale = Math.min(scale.value * 1.5, 4);
    scale.value = withSpring(newScale);
    savedScale.value = newScale;
  };

  const zoomOut = () => {
    const newScale = Math.max(scale.value / 1.5, 1);
    scale.value = withSpring(newScale);
    savedScale.value = newScale;
    if (newScale === 1) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <YStack flex={1} backgroundColor="rgba(0, 0, 0, 0.95)">
          {/* Header */}
          <XStack
            padding="$4"
            justifyContent="space-between"
            alignItems="center"
            zIndex={10}
          >
            <Text color="white" fontSize="$4">
              {currentIndex + 1} / {images.length}
            </Text>
            <XStack gap="$3">
              <Pressable onPress={zoomOut}>
                <ZoomOut size={24} color="white" />
              </Pressable>
              <Pressable onPress={zoomIn}>
                <ZoomIn size={24} color="white" />
              </Pressable>
              <Pressable onPress={handleDownload}>
                <Download size={24} color="white" />
              </Pressable>
              <Pressable onPress={onClose}>
                <X size={24} color="white" />
              </Pressable>
            </XStack>
          </XStack>

          {/* Image */}
          <YStack flex={1} justifyContent="center" alignItems="center">
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageContainer, animatedStyle]}>
                <Image
                  source={{ uri: images[currentIndex] }}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT * 0.7}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          </YStack>

          {/* Navigation */}
          {images.length > 1 && (
            <XStack
              position="absolute"
              top="50%"
              left={0}
              right={0}
              justifyContent="space-between"
              paddingHorizontal="$4"
              zIndex={10}
            >
              <Pressable
                onPress={goToPrevious}
                style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={32} color={currentIndex === 0 ? '#666' : 'white'} />
              </Pressable>
              <Pressable
                onPress={goToNext}
                style={[styles.navButton, currentIndex === images.length - 1 && styles.navButtonDisabled]}
                disabled={currentIndex === images.length - 1}
              >
                <ChevronRight size={32} color={currentIndex === images.length - 1 ? '#666' : 'white'} />
              </Pressable>
            </XStack>
          )}

          {/* Thumbnails */}
          {images.length > 1 && (
            <XStack
              padding="$4"
              gap="$2"
              justifyContent="center"
              flexWrap="wrap"
            >
              {images.map((image, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    setCurrentIndex(index);
                    resetTransform();
                  }}
                >
                  <Image
                    source={{ uri: image }}
                    width={60}
                    height={60}
                    borderRadius="$2"
                    borderWidth={2}
                    borderColor={index === currentIndex ? '$blue10' : 'transparent'}
                    opacity={index === currentIndex ? 1 : 0.6}
                  />
                </Pressable>
              ))}
            </XStack>
          )}
        </YStack>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
});

export default ImageViewer;
