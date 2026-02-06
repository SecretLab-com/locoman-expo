import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, loading, isCoordinator, isManager, isTrainer, isClient } = useAuthContext();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  // Initialize the video player with the local asset
  const videoSource = require("../assets/background.m4v");
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.muted = true;
    player.playbackRate = 0.7; // Updated from 0.5 to 0.7 as requested
    player.play();
  });

  // For web fallback, resolve asset URI
  const webVideoUri = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      return Asset.fromModule(videoSource).uri;
    } catch (e) {
      console.warn("[Welcome] Failed to resolve video asset:", e);
      return null;
    }
  }, [videoSource]);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }
  }, [webVideoUri]);

  const handleGetStarted = async () => {
    await haptics.light();
    router.push("/register");
  };

  const handleSignIn = async () => {
    await haptics.light();
    router.push("/login");
  };

  const handleBrowse = async () => {
    await haptics.light();
    // Navigate to the main tabs as a guest
    router.replace("/(tabs)?guest=true");
  };

  if (loading && !isAuthenticated) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Background */}
      {Platform.OS === 'web' ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: 'black',
          }}
          onCanPlay={(e) => {
            // Force playback rate on web
            e.currentTarget.playbackRate = 0.7;
          }}
        >
          {webVideoUri && <source src={webVideoUri} type="video/mp4" />}
        </video>
      ) : (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Dark Overlay with Gradient for text legibility */}
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.9)"]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenContainer
        edges={["top", "bottom", "left", "right"]}
        className="flex-1 px-6 justify-between"
        containerClassName="bg-transparent"
        style={{ backgroundColor: "transparent" }}
      >
        {/* Top Section: Logo & Brand */}
        <View style={{ marginTop: Math.max(insets.top, 40) }} className="items-center">
          <View className="w-24 h-24 bg-primary/20 rounded-3xl items-center justify-center mb-6 overflow-hidden border border-primary/30">
            <Image
              source={require("../assets/images/icon.png")}
              style={{ width: "60%", height: "60%" }}
              contentFit="contain"
            />
          </View>
          <Text className="text-4xl font-black text-white text-center tracking-tight">
            LOCO<Text className="text-primary">MOTIVATE</Text>
          </Text>
          <Text className="text-lg text-white/70 text-center mt-2 font-medium">
            Trainer-Powered Wellness Marketplace
          </Text>
        </View>

        {/* Bottom Section: Actions */}
        <View style={{ marginBottom: Math.max(insets.bottom, 40) }}>
          <Text className="text-white/60 text-center mb-8 px-8">
            Experience the next generation of personal training and wellness tracking.
          </Text>

          <TouchableOpacity
            className="bg-primary py-5 rounded-2xl items-center mb-4 shadow-xl shadow-primary/30"
            onPress={handleGetStarted}
            activeOpacity={0.9}
          >
            <Text className="text-black font-bold text-xl">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white/10 py-5 rounded-2xl items-center mb-6 border border-white/20"
            onPress={handleSignIn}
            activeOpacity={0.8}
            style={Platform.OS === 'ios' ? {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            } : {}}
          >
            <Text className="text-white font-semibold text-lg">Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBrowse}
            className="items-center"
            activeOpacity={0.7}
          >
            <Text className="text-white/50 font-medium">
              Just browsing? <Text className="text-white/80">Continue as guest</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
