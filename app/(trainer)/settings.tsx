import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { navigateToHome } from "@/lib/navigation";
import { useAuthContext } from "@/contexts/auth-context";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

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
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();
  const { isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  
  // Profile settings
  const [username, setUsername] = useState("@fitcoach");
  const [bio, setBio] = useState("Certified personal trainer specializing in weight loss and strength training. 10+ years of experience helping clients achieve their fitness goals.");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(["weight_loss", "strength"]);
  
  // Social links
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  
  // Availability
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);

  // Toggle specialty
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

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Save settings via tRPC
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert("Success", "Settings saved successfully!");
    } catch {
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header - leave space on right for ProfileFAB */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center pr-12">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-2"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigateToHome({ isCoordinator, isManager, isTrainer, isClient })}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="house.fill" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Profile</Text>
          
          {/* Avatar */}
          <View className="items-center mb-4">
            <View className="w-24 h-24 rounded-full bg-surface items-center justify-center overflow-hidden border-4 border-primary/20">
              <IconSymbol name="person.fill" size={40} color={colors.muted} />
            </View>
            <TouchableOpacity className="mt-2">
              <Text className="text-primary font-medium">Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Username */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground/80 mb-1">Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="@username"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            />
            <Text className="text-xs text-foreground/50 mt-1">
              This will be your public profile URL: locomotivate.com/t/{username.replace("@", "")}
            </Text>
          </View>

          {/* Bio */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground/80 mb-1">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[100px]"
            />
            <Text className="text-xs text-foreground/50 mt-1">
              {bio.length}/500 characters
            </Text>
          </View>
        </View>

        {/* Specialties Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-1">Specialties</Text>
          <Text className="text-sm text-foreground/60 mb-3">Select up to 5 specialties</Text>
          
          <View className="flex-row flex-wrap gap-2">
            {SPECIALTIES.map((specialty) => {
              const isSelected = selectedSpecialties.includes(specialty.value);
              return (
                <TouchableOpacity
                  key={specialty.value}
                  onPress={() => toggleSpecialty(specialty.value)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected ? "text-white font-semibold" : "text-foreground"
                    }`}
                  >
                    {specialty.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Social Links Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Social Links</Text>
          
          {/* Instagram */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground/80 mb-1">Instagram</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/50">instagram.com/</Text>
              <TextInput
                value={instagram}
                onChangeText={setInstagram}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3 text-foreground"
              />
            </View>
          </View>

          {/* Twitter */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground/80 mb-1">Twitter</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/50">twitter.com/</Text>
              <TextInput
                value={twitter}
                onChangeText={setTwitter}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3 text-foreground"
              />
            </View>
          </View>

          {/* LinkedIn */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground/80 mb-1">LinkedIn</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
              <Text className="text-foreground/50">linkedin.com/in/</Text>
              <TextInput
                value={linkedin}
                onChangeText={setLinkedin}
                placeholder="username"
                placeholderTextColor={colors.muted}
                className="flex-1 py-3 text-foreground"
              />
            </View>
          </View>

          {/* Website */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground/80 mb-1">Website</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            />
          </View>
        </View>

        {/* Availability Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Availability</Text>
          
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-medium text-primary">
                  Accepting New Clients
                </Text>
                <Text className="text-sm text-foreground/60">
                  Show your profile in the trainer directory
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

        {/* Appearance Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Appearance</Text>
          
          <View className="bg-surface rounded-xl border border-border">
            <View className="p-4">
              <Text className="text-base font-medium text-foreground mb-3">Theme</Text>
              <View className="flex-row gap-2">
                {(["system", "light", "dark"] as const).map((option) => {
                  const isSelected = themePreference === option;
                  const icons = {
                    system: "gearshape.fill",
                    light: "sun.max.fill",
                    dark: "moon.fill",
                  } as const;
                  const labels = {
                    system: "System",
                    light: "Light",
                    dark: "Dark",
                  };
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setThemePreference(option)}
                      className={`flex-1 items-center py-3 rounded-xl border ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      <IconSymbol
                        name={icons[option]}
                        size={24}
                        color={isSelected ? colors.primary : colors.muted}
                      />
                      <Text
                        className={`text-sm mt-1 font-medium ${
                          isSelected ? "text-primary" : "text-foreground/60"
                        }`}
                      >
                        {labels[option]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="text-xs text-foreground/50 mt-2 text-center">
                {themePreference === "system"
                  ? `Following system preference (currently ${colorScheme})`
                  : `Using ${themePreference} mode`}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Notifications</Text>
          
          <View className="bg-surface rounded-xl border border-border divide-y divide-border">
            {/* Email Notifications */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-medium text-primary">
                  Email Notifications
                </Text>
                <Text className="text-sm text-foreground/60">
                  Receive updates via email
                </Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Push Notifications */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-medium text-primary">
                  Push Notifications
                </Text>
                <Text className="text-sm text-foreground/60">
                  Receive push notifications on your device
                </Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Order Alerts */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-medium text-primary">
                  Order Alerts
                </Text>
                <Text className="text-sm text-foreground/60">
                  Get notified when clients place orders
                </Text>
              </View>
              <Switch
                value={orderAlerts}
                onValueChange={setOrderAlerts}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Session Reminders */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="text-base font-medium text-primary">
                  Session Reminders
                </Text>
                <Text className="text-sm text-foreground/60">
                  Get reminders before scheduled sessions
                </Text>
              </View>
              <Switch
                value={sessionReminders}
                onValueChange={setSessionReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Account</Text>
          
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Delete Account",
                "Are you sure you want to delete your account? This action cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => {} },
                ]
              );
            }}
            className="bg-error/10 border border-error/20 rounded-xl p-4"
          >
            <View className="flex-row items-center">
              <IconSymbol name="trash.fill" size={20} color="#EF4444" />
              <Text className="text-error font-medium ml-2">Delete Account</Text>
            </View>
            <Text className="text-error/70 text-sm mt-1">
              Permanently delete your account and all data
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding for save button */}
        <View className="h-32" />
      </ScrollView>

      {/* Sticky Save Button */}
      <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-xl items-center ${isSaving ? "bg-muted" : "bg-primary"}`}
        >
          <Text className="text-white font-semibold text-lg">
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
