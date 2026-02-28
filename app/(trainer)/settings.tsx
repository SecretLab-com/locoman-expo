import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/lib/api-config";
import { navigateToHome } from "@/lib/navigation";
import { useThemeContext } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function splitNameParts(fullName?: string | null): {
  firstName: string;
  lastName: string;
} {
  if (!fullName) return { firstName: "", lastName: "" };
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function copyToClipboard(text: string) {
  if (Platform.OS === "web") {
    const webClipboard = (globalThis as any)?.navigator?.clipboard;
    if (webClipboard?.writeText) {
      await webClipboard.writeText(text);
      return;
    }
  }
  const Clipboard = require("expo-clipboard");
  await Clipboard.setStringAsync(text);
}

function formatIsoDateForLabel(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

export default function SettingsScreen() {
  const colors = useColors();
  const bottomNavHeight = useBottomNavHeight();
  const insets = useSafeAreaInsets();
  const { themePreference, setThemePreference, colorScheme } =
    useThemeContext();
  const { isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const utils = trpc.useUtils();

  const { data: user, isLoading: isLoadingProfile } =
    trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      triggerAuthRefresh();
    },
  });
  const uploadAttachment = trpc.messages.uploadAttachment.useMutation();
  const openClawConnect = trpc.mcp.createOpenClawConnection.useMutation();

  // Profile settings state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Social links state
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [mcpEndpointKey, setMcpEndpointKey] = useState("");

  // Sync state with user data
  useEffect(() => {
    if (user) {
      const { firstName: parsedFirstName, lastName: parsedLastName } =
        splitNameParts(user.name);
      setFirstName(parsedFirstName);
      setLastName(parsedLastName);
      setUsername(user.username || "");
      setBio(user.bio || "");
      setPhotoUrl(user.photoUrl || null);

      try {
        const specs =
          typeof user.specialties === "string"
            ? JSON.parse(user.specialties)
            : user.specialties;
        setSelectedSpecialties(Array.isArray(specs) ? specs : []);
      } catch {
        setSelectedSpecialties([]);
      }

      try {
        const links =
          typeof user.socialLinks === "string"
            ? JSON.parse(user.socialLinks)
            : user.socialLinks;
        if (links && typeof links === "object") {
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
  const appVersion =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const buildNumber =
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    "8";
  const otaShortId = Updates.updateId
    ? Updates.updateId.slice(0, 8)
    : "embedded";
  const otaChannel = Updates.channel ?? "production";

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
      Alert.alert(
        "Permission Required",
        "Allow access to photos to change your profile picture.",
      );
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
        await utils.profile.get.invalidate();
        triggerAuthRefresh();
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
      const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateProfile.mutateAsync({
        name: combinedName || undefined,
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
      await utils.profile.get.invalidate();
      triggerAuthRefresh();
      Alert.alert("Success", "Profile saved successfully!");
    } catch (error) {
      console.error("[Settings] Save failed:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const applyEndpointKey = (template: string): string => {
    const connection = openClawConnect.data;
    if (!connection?.endpointKeyRequired) return template;
    const replacement =
      mcpEndpointKey.trim() || connection.endpointKeyPlaceholder;
    return template.split(connection.endpointKeyPlaceholder).join(replacement);
  };

  const handleGenerateOpenClawConnection = async () => {
    try {
      await openClawConnect.mutateAsync();
    } catch (error: any) {
      Alert.alert(
        "MCP connection failed",
        error?.message || "Could not generate OpenClaw connection data.",
      );
    }
  };

  const handleCopyOpenClawToken = async () => {
    const token = openClawConnect.data?.userAccessToken || "";
    if (!token) {
      Alert.alert("Not ready", "Generate connection data first.");
      return;
    }
    try {
      await copyToClipboard(token);
      Alert.alert("Copied", "User bearer token copied.");
    } catch {
      Alert.alert("Copy failed", "Could not copy token.");
    }
  };

  const handleCopyOpenClawCommand = async () => {
    const template = openClawConnect.data?.mcporterCommandTemplate || "";
    if (!template) {
      Alert.alert("Not ready", "Generate connection data first.");
      return;
    }
    const command = applyEndpointKey(template);
    try {
      await copyToClipboard(command);
      if (openClawConnect.data?.endpointKeyRequired && !mcpEndpointKey.trim()) {
        Alert.alert(
          "Copied with placeholder",
          "Command copied with ${LOCO_MCP_AUTH_TOKEN}. Replace it before running.",
        );
        return;
      }
      Alert.alert("Copied", "mcporter connect command copied.");
    } catch {
      Alert.alert("Copy failed", "Could not copy command.");
    }
  };

  const handleCopyOpenClawConfig = async () => {
    const template = openClawConnect.data?.mcporterConfigJsonTemplate || "";
    if (!template) {
      Alert.alert("Not ready", "Generate connection data first.");
      return;
    }
    const configJson = applyEndpointKey(template);
    try {
      await copyToClipboard(configJson);
      if (openClawConnect.data?.endpointKeyRequired && !mcpEndpointKey.trim()) {
        Alert.alert(
          "Copied with placeholder",
          "Config copied with ${LOCO_MCP_AUTH_TOKEN}. Replace it before use.",
        );
        return;
      }
      Alert.alert("Copied", "mcporter JSON config copied.");
    } catch {
      Alert.alert("Copy failed", "Could not copy config.");
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
          <Text className="text-lg font-semibold text-foreground mb-4">
            Profile
          </Text>

          <View className="items-center mb-6">
            <View className="w-24 h-24 rounded-full bg-surface items-center justify-center overflow-hidden border-4 border-primary/20">
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={{ width: "100%", height: "100%" }}
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
            <TouchableOpacity
              className="mt-3"
              onPress={handlePickPhoto}
              disabled={isUploading}
            >
              <Text className="text-primary font-semibold text-base">
                {isUploading ? "Uploading..." : "Change Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              First Name
            </Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground dark:text-white text-base"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              Last Name
            </Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground dark:text-white text-base"
            />
          </View>


          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              Bio
            </Text>
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
            <Text className="text-lg font-semibold text-foreground mb-3">
              Specialties
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SPECIALTIES.map((spec) => {
                const isSelected = selectedSpecialties.includes(spec.value);
                return (
                  <TouchableOpacity
                    key={spec.value}
                    onPress={() => toggleSpecialty(spec.value)}
                    className={`px-4 py-2.5 rounded-full border ${isSelected ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  >
                    <Text
                      className={`text-sm ${isSelected ? "text-white font-semibold" : "text-foreground"}`}
                    >
                      {spec.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Social Links */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Social Links
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              Instagram
            </Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-muted font-medium">instagram.com/</Text>
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
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              Twitter
            </Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-muted font-medium">twitter.com/</Text>
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
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              LinkedIn
            </Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-muted font-medium">linkedin.com/in/</Text>
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
            <Text className="text-sm font-medium text-foreground dark:text-white mb-2">
              Website
            </Text>
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
            <Text className="text-lg font-semibold text-foreground mb-4">
              Availability
            </Text>
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    Accepting New Clients
                  </Text>
                  <Text className="text-sm text-muted mt-0.5">
                    Show profile in directory
                  </Text>
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
          <Text className="text-lg font-semibold text-foreground mb-4">
            Appearance
          </Text>
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
                    <IconSymbol
                      name={
                        option === "system"
                          ? "gearshape.fill"
                          : option === "light"
                            ? "sun.max.fill"
                            : "moon.fill"
                      }
                      size={24}
                      color={isSelected ? colors.primary : colors.muted}
                    />
                    <Text
                      className={`text-sm mt-2 font-semibold ${isSelected ? "text-primary" : "text-muted"}`}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {(isTrainer || isCoordinator || isManager) && (
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              OpenClaw MCP
            </Text>
            <View className="bg-surface rounded-2xl border border-border p-4">
              <Text className="text-sm text-muted">
                Generate a user-scoped MCP connection bundle for OpenClaw. Your
                token stays tied to your user identity.
              </Text>

              <TouchableOpacity
                onPress={handleGenerateOpenClawConnection}
                disabled={openClawConnect.isPending}
                className={`mt-4 rounded-xl py-3 items-center ${
                  openClawConnect.isPending ? "bg-muted" : "bg-primary"
                }`}
              >
                {openClawConnect.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">
                    {openClawConnect.data
                      ? "Regenerate Connection Token"
                      : "Generate OpenClaw Connection"}
                  </Text>
                )}
              </TouchableOpacity>

              {openClawConnect.error ? (
                <Text className="text-xs text-error mt-2">
                  {openClawConnect.error.message ||
                    "Connection generation failed."}
                </Text>
              ) : null}

              {openClawConnect.data ? (
                <View className="mt-4">
                  <View className="bg-background border border-border rounded-xl p-3 mb-3">
                    <Text className="text-sm font-semibold text-foreground">
                      User:{" "}
                      {openClawConnect.data.userEmail ||
                        user?.email ||
                        "Unknown"}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      Expires:{" "}
                      {formatIsoDateForLabel(
                        openClawConnect.data.userAccessTokenExpiresAt,
                      )}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      MCP URL: {openClawConnect.data.mcpUrl}
                    </Text>
                  </View>

                  {openClawConnect.data.endpointKeyRequired ? (
                    <View className="mb-3">
                      <Text className="text-sm font-medium text-foreground mb-2">
                        MCP Endpoint Key
                      </Text>
                      <TextInput
                        value={mcpEndpointKey}
                        onChangeText={setMcpEndpointKey}
                        placeholder="Paste LOCO_MCP_AUTH_TOKEN (optional)"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base"
                      />
                      <Text className="text-xs text-muted mt-1">
                        If blank, copied output keeps ${"{LOCO_MCP_AUTH_TOKEN}"}{" "}
                        placeholder.
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleCopyOpenClawToken}
                    className="bg-background border border-border rounded-xl py-3 items-center mb-2"
                  >
                    <Text className="text-foreground font-semibold">
                      Copy User Token
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCopyOpenClawCommand}
                    className="bg-background border border-border rounded-xl py-3 items-center mb-2"
                  >
                    <Text className="text-foreground font-semibold">
                      Copy mcporter Command
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCopyOpenClawConfig}
                    className="bg-background border border-border rounded-xl py-3 items-center"
                  >
                    <Text className="text-foreground font-semibold">
                      Copy mcporter JSON Config
                    </Text>
                  </TouchableOpacity>

                  <Text className="text-xs text-muted mt-3">
                    Run the copied command on your OpenClaw host where mcporter
                    is installed.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <View className="mb-10">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Notifications
          </Text>
          <View className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {[
              {
                label: "Email Notifications",
                val: emailNotifications,
                set: setEmailNotifications,
              },
              {
                label: "Push Notifications",
                val: pushNotifications,
                set: setPushNotifications,
              },
              { label: "Order Alerts", val: orderAlerts, set: setOrderAlerts },
              {
                label: "Session Reminders",
                val: sessionReminders,
                set: setSessionReminders,
              },
            ].map((item, idx) => (
              <View
                key={idx}
                className="flex-row items-center justify-between p-4 py-5"
              >
                <Text className="text-base font-semibold text-foreground">
                  {item.label}
                </Text>
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
            onPress={() =>
              Alert.alert("Delete Account", "This action cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive" },
              ])
            }
            className="bg-error/5 border border-error/10 rounded-xl p-4"
          >
            <View className="flex-row items-center">
              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
              <Text className="text-error font-semibold ml-3 text-base">
                Delete Account
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="mb-6">
          <Text className="text-center text-xs text-muted">
            App version: {appVersion} ({buildNumber})
          </Text>
          <Text className="mt-1 text-center text-xs text-muted">
            OTA: {otaShortId} · Channel: {otaChannel}
          </Text>
        </View>

        <View className="h-24" />
      </ScrollView>

      <View
        className="absolute left-0 right-0 px-4 pt-4 bg-background/95 border-t border-border"
        style={{ bottom: 0, paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || isUploading}
          className={`w-full py-4 rounded-2xl items-center shadow-lg ${isSaving || isUploading ? "bg-muted shadow-none" : "bg-primary"}`}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          testID="settings-save-profile"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold text-lg">
              Save Profile Changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
