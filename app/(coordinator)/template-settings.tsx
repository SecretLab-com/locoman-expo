import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SPECIALTIES = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength" },
  { value: "longevity", label: "Longevity" },
  { value: "power", label: "Power" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
  { value: "endurance", label: "Endurance" },
  { value: "general_fitness", label: "General Fitness" },
];

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function TemplateSettingsScreen() {
  const colors = useColors();
  const { bundleId } = useLocalSearchParams<{ bundleId: string }>();
  const utils = trpc.useUtils();

  const { data: bundle, isLoading } = trpc.admin.getBundle.useQuery(
    { id: bundleId || "" },
    { enabled: Boolean(bundleId) },
  );

  const isAlreadyTemplate = bundle?.isTemplate === true;

  const [visibility, setVisibility] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");
  const [noEndDate, setNoEndDate] = useState(true);
  const [availableNow, setAvailableNow] = useState(true);

  // Populate from existing template settings when data loads
  const [populated, setPopulated] = useState(false);
  if (bundle && !populated) {
    const tv = bundle.templateVisibility;
    if (Array.isArray(tv) && tv.length > 0) setVisibility(tv as string[]);
    if (bundle.discountType === "percentage" || bundle.discountType === "fixed") {
      setDiscountType(bundle.discountType);
    }
    if (bundle.discountValue) setDiscountValue(String(bundle.discountValue));
    if (bundle.availabilityStart) {
      setAvailableNow(false);
      setAvailStart(bundle.availabilityStart.slice(0, 10));
    }
    if (bundle.availabilityEnd) {
      setNoEndDate(false);
      setAvailEnd(bundle.availabilityEnd.slice(0, 10));
    }
    setPopulated(true);
  }

  const promoteMutation = trpc.admin.promoteBundleToTemplate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.promotedTemplates.invalidate(),
        utils.bundles.templates.invalidate(),
      ]);
      haptics.success();
      showAlert("Template Created", "This bundle is now available as a template for trainers.");
      router.back();
    },
    onError: (err) => {
      haptics.error();
      showAlert("Error", err.message);
    },
  });

  const updateSettingsMutation = trpc.admin.updateTemplateSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.promotedTemplates.invalidate(),
        utils.bundles.templates.invalidate(),
        utils.admin.getBundle.invalidate({ id: bundleId }),
      ]);
      haptics.success();
      showAlert("Settings Updated", "Template settings have been saved.");
      router.back();
    },
    onError: (err) => {
      haptics.error();
      showAlert("Error", err.message);
    },
  });

  const isSaving = promoteMutation.isPending || updateSettingsMutation.isPending;

  const toggleSpecialty = (value: string) => {
    setVisibility((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSave = async () => {
    await haptics.light();

    if (discountType && !discountValue.trim()) {
      showAlert("Missing discount", "Enter a discount value or remove the discount type.");
      return;
    }

    const payload = {
      bundleId: bundleId!,
      templateVisibility: visibility,
      discountType: discountType ?? null,
      discountValue: discountType && discountValue.trim() ? discountValue.trim() : null,
      availabilityStart: availableNow ? null : (availStart || null),
      availabilityEnd: noEndDate ? null : (availEnd || null),
    };

    if (isAlreadyTemplate) {
      updateSettingsMutation.mutate(payload);
    } else {
      promoteMutation.mutate(payload);
    }
  };

  const serviceCount = Array.isArray(bundle?.servicesJson) ? bundle.servicesJson.length : 0;
  const productCount = Array.isArray(bundle?.productsJson) ? bundle.productsJson.length : 0;

  if (isLoading || !bundle) {
    return (
      <>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <ScreenContainer>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title={isAlreadyTemplate ? "Template Settings" : "Promote to Template"}
            subtitle={isAlreadyTemplate ? "Update visibility and discount settings" : "Configure this bundle as a trainer template"}
            leftSlot={
              <TouchableOpacity
                onPress={() => router.canGoBack() ? router.back() : router.replace("/(coordinator)/templates" as any)}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="template-settings-back"
              >
                <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              </TouchableOpacity>
            }
          />

          {/* Bundle summary */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-foreground font-semibold text-base">{bundle.title}</Text>
              {bundle.description && (
                <Text className="text-sm text-muted mt-1" numberOfLines={2}>{bundle.description}</Text>
              )}
              <View className="flex-row items-center gap-4 mt-2">
                {bundle.price && (
                  <Text className="text-sm text-primary font-semibold">${bundle.price}</Text>
                )}
                {serviceCount > 0 && (
                  <Text className="text-xs text-muted">{serviceCount} services</Text>
                )}
                {productCount > 0 && (
                  <Text className="text-xs text-muted">{productCount} products</Text>
                )}
              </View>
            </SurfaceCard>
          </View>

          {/* Specialty visibility */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-1">Visibility</Text>
              <Text className="text-xs text-muted mb-3">
                Which trainer specialties can see this template? Leave empty for all trainers.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SPECIALTIES.map((spec) => {
                  const active = visibility.includes(spec.value);
                  return (
                    <TouchableOpacity
                      key={spec.value}
                      onPress={() => toggleSpecialty(spec.value)}
                      className={`px-3 py-2 rounded-full border ${active ? "bg-primary border-primary" : "bg-surface border-border"}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${active ? "Remove" : "Add"} ${spec.label}`}
                    >
                      <Text className={`text-xs font-medium ${active ? "text-background" : "text-foreground"}`}>
                        {spec.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {visibility.length > 0 && (
                <TouchableOpacity onPress={() => setVisibility([])} className="mt-2">
                  <Text className="text-xs text-muted">Clear all (visible to everyone)</Text>
                </TouchableOpacity>
              )}
            </SurfaceCard>
          </View>

          {/* Discount */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-1">Discount</Text>
              <Text className="text-xs text-muted mb-3">
                Optional discount applied when trainers use this template.
              </Text>
              <View className="flex-row gap-2 mb-3">
                <TouchableOpacity
                  onPress={() => setDiscountType(discountType === "percentage" ? null : "percentage")}
                  className={`flex-1 py-2.5 rounded-lg items-center border ${discountType === "percentage" ? "bg-primary border-primary" : "bg-surface border-border"}`}
                >
                  <Text className={`text-sm font-medium ${discountType === "percentage" ? "text-background" : "text-foreground"}`}>
                    Percentage
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDiscountType(discountType === "fixed" ? null : "fixed")}
                  className={`flex-1 py-2.5 rounded-lg items-center border ${discountType === "fixed" ? "bg-primary border-primary" : "bg-surface border-border"}`}
                >
                  <Text className={`text-sm font-medium ${discountType === "fixed" ? "text-background" : "text-foreground"}`}>
                    Fixed Amount
                  </Text>
                </TouchableOpacity>
              </View>
              {discountType && (
                <View className="flex-row items-center">
                  <Text className="text-foreground font-medium mr-2">
                    {discountType === "percentage" ? "%" : "£"}
                  </Text>
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10.00"}
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </SurfaceCard>
          </View>

          {/* Availability */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-1">Availability</Text>
              <Text className="text-xs text-muted mb-3">
                When should this template be available to trainers?
              </Text>

              <View className="mb-3">
                <TouchableOpacity
                  onPress={() => setAvailableNow(!availableNow)}
                  className="flex-row items-center"
                >
                  <View className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${availableNow ? "bg-primary border-primary" : "border-border"}`}>
                    {availableNow && <IconSymbol name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text className="text-sm text-foreground">Available immediately</Text>
                </TouchableOpacity>
                {!availableNow && (
                  <TextInput
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mt-2"
                    value={availStart}
                    onChangeText={setAvailStart}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                  />
                )}
              </View>

              <View>
                <TouchableOpacity
                  onPress={() => setNoEndDate(!noEndDate)}
                  className="flex-row items-center"
                >
                  <View className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${noEndDate ? "bg-primary border-primary" : "border-border"}`}>
                    {noEndDate && <IconSymbol name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text className="text-sm text-foreground">No end date</Text>
                </TouchableOpacity>
                {!noEndDate && (
                  <TextInput
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mt-2"
                    value={availEnd}
                    onChangeText={setAvailEnd}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                  />
                )}
              </View>
            </SurfaceCard>
          </View>

          {/* Save button */}
          <View className="px-4 pb-8">
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center"
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={isAlreadyTemplate ? "Update template settings" : "Promote to template"}
              testID="template-settings-save"
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-semibold text-base">
                  {isAlreadyTemplate ? "Update Settings" : "Promote to Template"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
