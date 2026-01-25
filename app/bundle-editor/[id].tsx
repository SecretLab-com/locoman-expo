import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { SingleImagePicker } from "@/components/media-picker";
import { buildBundleImagePrompt } from "@/lib/image-generation";

// Service types for bundles
type ServiceItem = {
  id: string;
  type: "training_session" | "check_in" | "call" | "plan_review";
  name: string;
  quantity: number;
  frequency: "weekly" | "monthly" | "one_time";
};

// Product item for bundles
type ProductItem = {
  id: number;
  name: string;
  price: string;
  quantity: number;
  image?: string;
};

// Bundle form state
type BundleFormState = {
  title: string;
  description: string;
  price: string;
  cadence: "one_time" | "weekly" | "monthly";
  imageUrl: string;
  services: ServiceItem[];
  products: ProductItem[];
  goals: string[];
};

const CADENCE_OPTIONS = [
  { value: "one_time" as const, label: "One-Time" },
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
];

const SERVICE_TYPES = [
  { type: "training_session" as const, name: "Training Session", icon: "dumbbell.fill" },
  { type: "check_in" as const, name: "Check-In", icon: "checkmark.circle.fill" },
  { type: "call" as const, name: "Video Call", icon: "video.fill" },
  { type: "plan_review" as const, name: "Plan Review", icon: "doc.text.fill" },
];

const GOAL_OPTIONS = [
  "Weight Loss",
  "Muscle Building",
  "Strength Training",
  "Flexibility",
  "Endurance",
  "General Fitness",
  "Sports Performance",
  "Injury Recovery",
];

export default function BundleEditorScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNewBundle = id === "new";

  const [loading, setLoading] = useState(!isNewBundle);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  
  // AI image generation mutation
  const generateImageMutation = trpc.ai.generateBundleImage.useMutation();
  const [activeSection, setActiveSection] = useState<"basic" | "services" | "products" | "goals">("basic");

  const [form, setForm] = useState<BundleFormState>({
    title: "",
    description: "",
    price: "",
    cadence: "monthly",
    imageUrl: "",
    services: [],
    products: [],
    goals: [],
  });

  // Fetch existing bundle data if editing
  useEffect(() => {
    if (!isNewBundle && id) {
      loadBundle(parseInt(id));
    }
  }, [id, isNewBundle]);

  const loadBundle = async (bundleId: number) => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const bundle = await trpc.bundles.get.query({ id: bundleId });
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Mock data for now
      setForm({
        title: "Sample Bundle",
        description: "A great fitness bundle",
        price: "99.99",
        cadence: "monthly",
        imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
        services: [
          { id: "1", type: "training_session", name: "Training Session", quantity: 4, frequency: "monthly" },
        ],
        products: [],
        goals: ["Weight Loss", "Muscle Building"],
      });
    } catch (error) {
      console.error("Failed to load bundle:", error);
      Alert.alert("Error", "Failed to load bundle data");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = useCallback(<K extends keyof BundleFormState>(key: K, value: BundleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addService = (type: ServiceItem["type"]) => {
    const serviceType = SERVICE_TYPES.find((s) => s.type === type);
    if (!serviceType) return;

    const newService: ServiceItem = {
      id: Date.now().toString(),
      type,
      name: serviceType.name,
      quantity: 1,
      frequency: form.cadence === "one_time" ? "one_time" : form.cadence,
    };

    updateForm("services", [...form.services, newService]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    updateForm(
      "services",
      form.services.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeService = (id: string) => {
    updateForm(
      "services",
      form.services.filter((s) => s.id !== id)
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleGoal = (goal: string) => {
    if (form.goals.includes(goal)) {
      updateForm(
        "goals",
        form.goals.filter((g) => g !== goal)
      );
    } else {
      updateForm("goals", [...form.goals, goal]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      Alert.alert("Validation Error", "Please enter a bundle title");
      return false;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      Alert.alert("Validation Error", "Please enter a valid price");
      return false;
    }
    return true;
  };

  const handleSave = async (submitForReview = false) => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // TODO: Replace with actual API call
      // if (isNewBundle) {
      //   await trpc.bundles.create.mutate({...form});
      // } else {
      //   await trpc.bundles.update.mutate({ id: parseInt(id), ...form });
      // }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        submitForReview
          ? "Bundle submitted for review!"
          : `Bundle ${isNewBundle ? "created" : "updated"} successfully!`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Failed to save bundle:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save bundle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Bundle",
      "Are you sure you want to delete this bundle? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              // TODO: API call to delete
              await new Promise((resolve) => setTimeout(resolve, 500));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete bundle");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading bundle...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">
            {isNewBundle ? "Create Bundle" : "Edit Bundle"}
          </Text>
          <TouchableOpacity
            onPress={() => handleSave(false)}
            disabled={saving}
            className="p-2 -mr-2"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text className="text-primary font-semibold">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <View className="flex-row bg-surface border-b border-border">
          {(["basic", "services", "products", "goals"] as const).map((section) => (
            <TouchableOpacity
              key={section}
              className={`flex-1 py-3 ${activeSection === section ? "border-b-2 border-primary" : ""}`}
              onPress={() => setActiveSection(section)}
            >
              <Text
                className={`text-center text-sm font-medium capitalize ${
                  activeSection === section ? "text-primary" : "text-muted"
                }`}
              >
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Basic Info Section */}
          {activeSection === "basic" && (
            <View className="p-4 gap-4">
              {/* Bundle Image */}
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Bundle Image</Text>
                <SingleImagePicker
                  image={form.imageUrl || null}
                  onImageChange={(uri) => updateForm("imageUrl", uri || "")}
                  aspectRatio={[16, 9]}
                  placeholder="Add Bundle Cover Image"
                />
                
                {/* AI Generate Button */}
                <TouchableOpacity
                  className={`mt-2 flex-row items-center justify-center py-3 rounded-xl border ${
                    generatingImage ? "bg-surface border-border" : "bg-primary/10 border-primary"
                  }`}
                  onPress={async () => {
                    if (!form.title.trim()) {
                      Alert.alert("Title Required", "Please enter a bundle title first to generate an image.");
                      return;
                    }
                    setGeneratingImage(true);
                    try {
                      const result = await generateImageMutation.mutateAsync({
                        title: form.title,
                        description: form.description || undefined,
                        goals: form.goals.length > 0 ? form.goals : undefined,
                        style: "fitness",
                      });
                      if (result.url) {
                        updateForm("imageUrl", result.url);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    } catch (error) {
                      console.error("Failed to generate image:", error);
                      Alert.alert("Error", "Failed to generate image. Please try again.");
                    } finally {
                      setGeneratingImage(false);
                    }
                  }}
                  disabled={generatingImage}
                >
                  {generatingImage ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text className="text-primary font-medium ml-2">Generating...</Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol name="sparkles" size={18} color={colors.primary} />
                      <Text className="text-primary font-medium ml-2">Generate with AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Title */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Bundle Title *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Enter bundle title"
                  placeholderTextColor={colors.muted}
                  value={form.title}
                  onChangeText={(text) => updateForm("title", text)}
                />
              </View>

              {/* Description */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Description</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[100px]"
                  placeholder="Describe your bundle..."
                  placeholderTextColor={colors.muted}
                  value={form.description}
                  onChangeText={(text) => updateForm("description", text)}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Price */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Price *</Text>
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                  <Text className="text-foreground text-lg mr-1">$</Text>
                  <TextInput
                    className="flex-1 py-3 text-foreground text-lg"
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    value={form.price}
                    onChangeText={(text) => updateForm("price", text.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Cadence */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Billing Cadence</Text>
                <View className="flex-row gap-2">
                  {CADENCE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      className={`flex-1 py-3 rounded-xl border ${
                        form.cadence === option.value
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      }`}
                      onPress={() => updateForm("cadence", option.value)}
                    >
                      <Text
                        className={`text-center font-medium ${
                          form.cadence === option.value ? "text-background" : "text-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Services Section */}
          {activeSection === "services" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                Add services included in this bundle. Sessions will be tracked for usage.
              </Text>

              {/* Add Service Buttons */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                {SERVICE_TYPES.map((serviceType) => (
                  <TouchableOpacity
                    key={serviceType.type}
                    className="bg-surface border border-border rounded-lg px-3 py-2 flex-row items-center"
                    onPress={() => addService(serviceType.type)}
                  >
                    <IconSymbol name="plus" size={14} color={colors.primary} />
                    <Text className="text-foreground ml-2">{serviceType.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Service List */}
              {form.services.length === 0 ? (
                <View className="items-center py-8 bg-surface rounded-xl">
                  <IconSymbol name="calendar" size={40} color={colors.muted} />
                  <Text className="text-muted mt-2">No services added yet</Text>
                  <Text className="text-muted text-sm">Tap a button above to add services</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {form.services.map((service) => (
                    <View
                      key={service.id}
                      className="bg-surface border border-border rounded-xl p-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-foreground font-medium">{service.name}</Text>
                        <TouchableOpacity onPress={() => removeService(service.id)}>
                          <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>

                      <View className="flex-row items-center gap-4">
                        <View className="flex-1">
                          <Text className="text-xs text-muted mb-1">Quantity</Text>
                          <View className="flex-row items-center bg-background rounded-lg">
                            <TouchableOpacity
                              className="p-2"
                              onPress={() =>
                                updateService(service.id, {
                                  quantity: Math.max(1, service.quantity - 1),
                                })
                              }
                            >
                              <IconSymbol name="minus" size={16} color={colors.foreground} />
                            </TouchableOpacity>
                            <Text className="flex-1 text-center text-foreground font-medium">
                              {service.quantity}
                            </Text>
                            <TouchableOpacity
                              className="p-2"
                              onPress={() =>
                                updateService(service.id, { quantity: service.quantity + 1 })
                              }
                            >
                              <IconSymbol name="plus" size={16} color={colors.foreground} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="flex-1">
                          <Text className="text-xs text-muted mb-1">Frequency</Text>
                          <View className="flex-row bg-background rounded-lg overflow-hidden">
                            {(["weekly", "monthly"] as const).map((freq) => (
                              <TouchableOpacity
                                key={freq}
                                className={`flex-1 py-2 ${
                                  service.frequency === freq ? "bg-primary" : ""
                                }`}
                                onPress={() => updateService(service.id, { frequency: freq })}
                              >
                                <Text
                                  className={`text-center text-xs capitalize ${
                                    service.frequency === freq ? "text-background" : "text-muted"
                                  }`}
                                >
                                  {freq}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Products Section */}
          {activeSection === "products" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                Add products to include with this bundle.
              </Text>

              <TouchableOpacity
                className="bg-surface border border-dashed border-border rounded-xl p-6 items-center"
                onPress={() => Alert.alert("Coming Soon", "Product selection will be available soon")}
              >
                <IconSymbol name="bag.fill" size={40} color={colors.muted} />
                <Text className="text-muted mt-2">Tap to add products</Text>
                <Text className="text-muted text-sm">Search from available inventory</Text>
              </TouchableOpacity>

              {form.products.length > 0 && (
                <View className="mt-4 gap-3">
                  {form.products.map((product) => (
                    <View
                      key={product.id}
                      className="bg-surface border border-border rounded-xl p-3 flex-row items-center"
                    >
                      {product.image && (
                        <Image
                          source={{ uri: product.image }}
                          className="w-12 h-12 rounded-lg mr-3"
                          contentFit="cover"
                        />
                      )}
                      <View className="flex-1">
                        <Text className="text-foreground font-medium">{product.name}</Text>
                        <Text className="text-muted text-sm">${product.price}</Text>
                      </View>
                      <Text className="text-foreground font-medium mr-2">x{product.quantity}</Text>
                      <TouchableOpacity>
                        <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Goals Section */}
          {activeSection === "goals" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                Select the fitness goals this bundle helps achieve.
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = form.goals.includes(goal);
                  return (
                    <TouchableOpacity
                      key={goal}
                      className={`px-4 py-2 rounded-full border ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      }`}
                      onPress={() => toggleGoal(goal)}
                    >
                      <Text
                        className={`font-medium ${
                          isSelected ? "text-background" : "text-foreground"
                        }`}
                      >
                        {goal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Bottom Spacer */}
          <View className="h-32" />
        </ScrollView>

        {/* Bottom Actions */}
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-8">
          <View className="flex-row gap-3">
            {!isNewBundle && (
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl border border-error"
                onPress={handleDelete}
                disabled={saving}
              >
                <Text className="text-error text-center font-semibold">Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl bg-surface border border-border"
              onPress={() => handleSave(false)}
              disabled={saving}
            >
              <Text className="text-foreground text-center font-semibold">Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl bg-primary"
              onPress={() => handleSave(true)}
              disabled={saving}
            >
              <Text className="text-background text-center font-semibold">Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
