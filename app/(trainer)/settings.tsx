import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/lib/api-config";
import { navigateToHome } from "@/lib/navigation";
import { useThemeContext } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SPECIALTIES = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength Training" },
  { value: "longevity", label: "Longevity" },
  { value: "nutrition", label: "Nutrition" },
  { value: "yoga", label: "Yoga" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
  { value: "sports", label: "Sports Performance" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const bottomNavHeight = useBottomNavHeight();
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();
  const { isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const utils = trpc.useUtils();

  const { data: user, isLoading: isLoadingProfile } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
    },
  });
  const uploadAttachment = trpc.messages.uploadAttachment.useMutation();

  // Profile settings state
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Social links state
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");

  // Sync state with user data
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setBio(user.bio || "");
      setPhotoUrl(user.photoUrl || null);

      try {
        const specs = typeof user.specialties === 'string' ? JSON.parse(user.specialties) : user.specialties;
        setSelectedSpecialties(Array.isArray(specs) ? specs : []);
      } catch {
        setSelectedSpecialties([]);
      }

      try {
        const links = typeof user.socialLinks === 'string' ? JSON.parse(user.socialLinks) : user.socialLinks;
        if (links && typeof links === 'object') {
          setInstagram(links.instagram || "");
          setTwitter(links.twitter || "");
          setLinkedin(links.linkedin || "");
          setWebsite(links.website || "");
        }
      } catch {
        // Ignore JSON errors
      }
    }
  }, [user]);

  // Settings state defaults
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resolveImageUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const toggleSpecialty = (value: string) => {
    if (selectedSpecialties.includes(value)) {
      setSelectedSpecialties(selectedSpecialties.filter((s) => s !== value));
    } else {
      if (selectedSpecialties.length < 5) {
        setSelectedSpecialties([...selectedSpecialties, value]);
      } else {
        Alert.alert("Limit Reached", "You can select up to 5 specialties.");
      }
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Allow access to photos to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setIsUploading(true);
      try {
        const asset = result.assets[0];
        const res = await uploadAttachment.mutateAsync({
          fileName: asset.fileName || `profile_${Date.now()}.jpg`,
          fileData: asset.base64 || "",
          mimeType: asset.mimeType || "image/jpeg",
        });

        await updateProfile.mutateAsync({ photoUrl: res.url });
        setPhotoUrl(res.url);
        Alert.alert("Success", "Profile photo updated!");
      } catch (error) {
        console.error("[Settings] Upload failed:", error);
        Alert.alert("Error", "Failed to upload photo.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        username,
        bio,
        specialties: selectedSpecialties,
        socialLinks: {
          instagram,
          twitter,
          linkedin,
          website,
        },
      });
      Alert.alert("Success", "Profile saved successfully!");
    } catch (error) {
      console.error("[Settings] Save failed:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigateToHome({ isCoordinator, isManager, isTrainer, isClient });
  };

  if (isLoadingProfile) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const profileImageUrl = resolveImageUrl(photoUrl);

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center pr-12">
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Profile</Text>

          <View className="items-center mb-6">
            <View className="w-24 h-24 rounded-full bg-surface items-center justify-center overflow-hidden border-4 border-primary/20">
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <IconSymbol name="person.fill" size={40} color={colors.muted} />
              )}
              {isUploading && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <TouchableOpacity className="mt-3" onPress={handlePickPhoto} disabled={isUploading}>
              <Text className="text-primary font-semibold text-base">
                {isUploading ? "Uploading..." : "Change Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="@username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground dark:text-white text-base"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground dark:text-white min-h-[120px] text-base"
            />
          </View>
        </View>

        {isTrainer && (
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-3">Specialties</Text>
            <View className="flex-row flex-wrap gap-2">
              {SPECIALTIES.map((spec) => {
                const isSelected = selectedSpecialties.includes(spec.value);
                return (
                  <TouchableOpacity
                    key={spec.value}
                    onPress={() => toggleSpecialty(spec.value)}
                    className={`px-4 py-2.5 rounded-full border ${isSelected ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  >
                    <Text className={`text-sm ${isSelected ? "text-white font-semibold" : "text-foreground"}`}>{spec.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Social Links */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-foreground mb-4">Social Links</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">Instagram</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/60 dark:text-white/50 font-medium">instagram.com/</Text>
              <TextInput
                value={instagram}
                onChangeText={setInstagram}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3.5 ml-1 text-foreground dark:text-white text-base"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">Twitter</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/60 dark:text-white/50 font-medium">twitter.com/</Text>
              <TextInput
                value={twitter}
                onChangeText={setTwitter}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3.5 ml-1 text-foreground dark:text-white text-base"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">LinkedIn</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/60 dark:text-white/50 font-medium">linkedin.com/in/</Text>
              <TextInput
                value={linkedin}
                onChangeText={setLinkedin}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3.5 ml-1 text-foreground dark:text-white text-base"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">Website</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground dark:text-white text-base"
            />
          </View>
        </View>

        {isTrainer && (
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">Availability</Text>
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Accepting New Clients</Text>
                  <Text className="text-sm text-foreground/60 mt-0.5">Show profile in directory</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        )}

        <View className="mb-8">
          <Text className="text-lg font-semibold text-foreground mb-4">Appearance</Text>
          <View className="bg-surface rounded-2xl border border-border overflow-hidden p-4">
            <View className="flex-row gap-3">
              {(["system", "light", "dark"] as const).map((option) => {
                const isSelected = themePreference === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setThemePreference(option)}
                    className={`flex-1 items-center py-4 rounded-xl border ${isSelected ? "bg-primary/10 border-primary" : "bg-background border-border"}`}
                  >
                    <IconSymbol name={option === 'system' ? 'gearshape.fill' : option === 'light' ? 'sun.max.fill' : 'moon.fill'} size={24} color={isSelected ? colors.primary : colors.muted} />
                    <Text className={`text-sm mt-2 font-semibold ${isSelected ? "text-primary" : "text-foreground/60"}`}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View className="mb-10">
          <Text className="text-lg font-semibold text-foreground mb-4">Notifications</Text>
          <View className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {[
              { label: "Email Notifications", val: emailNotifications, set: setEmailNotifications },
              { label: "Push Notifications", val: pushNotifications, set: setPushNotifications },
              { label: "Order Alerts", val: orderAlerts, set: setOrderAlerts },
              { label: "Session Reminders", val: sessionReminders, set: setSessionReminders },
            ].map((item, idx) => (
              <View key={idx} className="flex-row items-center justify-between p-4 py-5">
                <Text className="text-base font-semibold text-foreground">{item.label}</Text>
                <Switch
                  value={item.val}
                  onValueChange={item.set}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        </View>

        <View className="mb-12">
          <TouchableOpacity
            onPress={() => Alert.alert("Delete Account", "This action cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive" }])}
            className="bg-error/5 border border-error/10 rounded-xl p-4"
          >
            <View className="flex-row items-center">
              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
              <Text className="text-error font-semibold ml-3 text-base">Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="h-24" />
      </ScrollView>

      <View className="absolute left-0 right-0 px-4 py-6 bg-background/95 border-t border-border" style={{ bottom: -(bottomNavHeight - 12) }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || isUploading}
          className={`w-full py-4 rounded-2xl items-center shadow-lg ${isSaving || isUploading ? "bg-muted shadow-none" : "bg-primary"}`}
        >
          {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-lg">Save Profile Changes</Text>}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
