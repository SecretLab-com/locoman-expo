import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
];

function showAlert(title: string, message: string) {
  Alert.alert(title, message);
}

export default function TemplateSettingsScreen() {
  const colors = useColors();
  const { bundleId } = useLocalSearchParams<{ bundleId: string }>();
  const utils = trpc.useUtils();

  const bundleQuery = trpc.admin.getBundle.useQuery(
    { id: bundleId || "" },
    { enabled: Boolean(bundleId) },
  );
  const bundle = bundleQuery.data;
  const isLoading = bundleQuery.isLoading;

  const isAlreadyTemplate = bundle?.isTemplate === true;
  const { data: brandAccounts = [] } = trpc.admin.listCampaignAccounts.useQuery({
    accountType: "brand",
    activeOnly: true,
    limit: 400,
  });
  const { data: templateCampaignLinks = [] } =
    trpc.admin.getTemplateCampaignAccounts.useQuery(
      { bundleId: bundleId || "" },
      { enabled: Boolean(bundleId && isAlreadyTemplate) },
    );

  const [visibility, setVisibility] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");
  const [noEndDate, setNoEndDate] = useState(true);
  const [availableNow, setAvailableNow] = useState(true);
  const [selectedBrandAccountId, setSelectedBrandAccountId] = useState<string | null>(
    null,
  );
  const [requiredHashtags, setRequiredHashtags] = useState("");
  const [requiredMentions, setRequiredMentions] = useState("");
  const [allowedPlatforms, setAllowedPlatforms] = useState<string[]>([]);
  const [postingWindowStart, setPostingWindowStart] = useState("");
  const [postingWindowEnd, setPostingWindowEnd] = useState("");
  const [requiredLinkSlug, setRequiredLinkSlug] = useState("");
  const [requiredPosts, setRequiredPosts] = useState("");

  const selectedBrandLink = useMemo(
    () =>
      (templateCampaignLinks || []).find(
        (link: any) => link?.relationType === "brand" && link?.campaignAccountId,
      ),
    [templateCampaignLinks],
  );

  useEffect(() => {
    if (!selectedBrandAccountId && selectedBrandLink?.campaignAccountId) {
      setSelectedBrandAccountId(String(selectedBrandLink.campaignAccountId));
    }
  }, [selectedBrandAccountId, selectedBrandLink?.campaignAccountId]);

  useEffect(() => {
    const rules =
      selectedBrandLink?.metadata?.postingRules &&
      typeof selectedBrandLink.metadata.postingRules === "object"
        ? selectedBrandLink.metadata.postingRules
        : {};
    setRequiredHashtags(
      Array.isArray(rules.requiredHashtags) ? rules.requiredHashtags.join(", ") : "",
    );
    setRequiredMentions(
      Array.isArray(rules.requiredMentions) ? rules.requiredMentions.join(", ") : "",
    );
    setAllowedPlatforms(
      Array.isArray(rules.allowedPlatforms)
        ? rules.allowedPlatforms.map((value: any) => String(value || "").trim().toLowerCase()).filter(Boolean)
        : [],
    );
    setPostingWindowStart(
      rules.postingWindowStart ? String(rules.postingWindowStart).slice(0, 10) : "",
    );
    setPostingWindowEnd(
      rules.postingWindowEnd ? String(rules.postingWindowEnd).slice(0, 10) : "",
    );
    setRequiredLinkSlug(String(rules.requiredLinkSlug || ""));
    setRequiredPosts(
      rules.requiredPosts ? String(rules.requiredPosts) : "",
    );
  }, [selectedBrandLink?.metadata]);

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
    if (selectedBrandLink?.campaignAccountId) {
      setSelectedBrandAccountId(String(selectedBrandLink.campaignAccountId));
    }
    setPopulated(true);
  }

  const promoteMutation = trpc.admin.promoteBundleToTemplate.useMutation();

  const updateSettingsMutation = trpc.admin.updateTemplateSettings.useMutation();
  const setTemplateCampaignAccountsMutation =
    trpc.admin.setTemplateCampaignAccounts.useMutation();
  const generateShareMutation = trpc.admin.generateCampaignShareLink.useMutation();
  const setShareEnabledMutation = trpc.admin.setCampaignShareEnabled.useMutation();

  const isSaving =
    promoteMutation.isPending ||
    updateSettingsMutation.isPending ||
    setTemplateCampaignAccountsMutation.isPending ||
    generateShareMutation.isPending ||
    setShareEnabledMutation.isPending;

  const shareUrl = bundle?.publicShareSlug
    ? `${String(process.env.EXPO_PUBLIC_APP_URL || "https://bright.coach").replace(/\/+$/g, "")}/campaign/${bundle.publicShareSlug}`
    : null;

  const toggleSpecialty = (value: string) => {
    setVisibility((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const togglePlatform = (value: string) => {
    setAllowedPlatforms((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleSave = async () => {
    await haptics.light();

    if (discountType && !discountValue.trim()) {
      showAlert("Missing discount", "Enter a discount value or remove the discount type.");
      return;
    }
    if (!selectedBrandAccountId) {
      showAlert("Missing brand", "Select a brand for this campaign.");
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

    try {
      if (isAlreadyTemplate) {
        await updateSettingsMutation.mutateAsync(payload);
      } else {
        await promoteMutation.mutateAsync(payload);
      }
      await setTemplateCampaignAccountsMutation.mutateAsync({
        bundleId: bundleId!,
        links: [
          {
            campaignAccountId: selectedBrandAccountId,
            relationType: "brand",
            allocationPct: "100",
            metadata: {
              postingRules: {
                requiredHashtags: requiredHashtags
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                requiredMentions: requiredMentions
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                allowedPlatforms,
                postingWindowStart: postingWindowStart || null,
                postingWindowEnd: postingWindowEnd || null,
                requiredLinkSlug: requiredLinkSlug.trim() || null,
                requiredPosts: requiredPosts.trim()
                  ? Math.max(1, Number(requiredPosts.trim()) || 1)
                  : null,
              },
            },
          },
        ],
      });
      if (!bundle?.publicShareSlug) {
        await generateShareMutation.mutateAsync({ bundleId: bundleId! });
      } else if (!bundle.publicShareEnabled) {
        await setShareEnabledMutation.mutateAsync({
          bundleId: bundleId!,
          enabled: true,
        });
      }
      await Promise.all([
        utils.admin.promotedTemplates.invalidate(),
        utils.admin.listCampaignTemplates.invalidate(),
        utils.bundles.templates.invalidate(),
        utils.admin.getBundle.invalidate({ id: bundleId }),
        utils.admin.getTemplateCampaignAccounts.invalidate({ bundleId: bundleId! }),
      ]);
      haptics.success();
      showAlert(
        isAlreadyTemplate ? "Campaign Updated" : "Campaign Created",
        "Campaign settings were saved and sharing is enabled.",
      );
      router.back();
    } catch (err: any) {
      haptics.error();
      showAlert("Error", err?.message || "Failed to save campaign settings.");
    }
  };

  const handleGenerateShareLink = async () => {
    if (!bundleId) return;
    try {
      await haptics.light();
      const result = await generateShareMutation.mutateAsync({ bundleId });
      await Promise.all([
        utils.admin.getBundle.invalidate({ id: bundleId }),
        utils.admin.listCampaignTemplates.invalidate(),
      ]);
      await bundleQuery.refetch();
      await haptics.success();
      showAlert(
        "Link generated",
        result?.url
          ? `Public link is ready:\n${result.url}`
          : "Campaign share link generated successfully.",
      );
    } catch (err: any) {
      await haptics.error();
      showAlert("Unable to generate link", err?.message || "Please try again.");
    }
  };

  const handleToggleShareEnabled = async () => {
    if (!bundleId) return;
    try {
      await haptics.light();
      const result = await setShareEnabledMutation.mutateAsync({
        bundleId,
        enabled: !bundle?.publicShareEnabled,
      });
      await Promise.all([
        utils.admin.getBundle.invalidate({ id: bundleId }),
        utils.admin.listCampaignTemplates.invalidate(),
      ]);
      await bundleQuery.refetch();
      await haptics.success();
      showAlert(
        result.enabled ? "Link enabled" : "Link disabled",
        result.url
          ? `Share URL:\n${result.url}`
          : "You can re-enable this link any time.",
      );
    } catch (err: any) {
      await haptics.error();
      showAlert("Unable to update link", err?.message || "Please try again.");
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

          {/* Brand selection */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-1">Brand</Text>
              <Text className="text-xs text-muted mb-3">
                Select a brand account for sorting, search, and reporting.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {brandAccounts.map((brand: any) => {
                  const active = selectedBrandAccountId === brand.id;
                  return (
                    <TouchableOpacity
                      key={brand.id}
                      onPress={() => setSelectedBrandAccountId(brand.id)}
                      className={`px-3 py-2 rounded-full border ${active ? "bg-primary border-primary" : "bg-surface border-border"}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Select brand ${brand.name}`}
                      testID={`template-brand-${brand.id}`}
                    >
                      <Text
                        className={`text-xs font-medium ${active ? "text-background" : "text-foreground"}`}
                      >
                        {brand.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SurfaceCard>
          </View>

          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-1">
                Post attribution rules
              </Text>
              <Text className="text-xs text-muted mb-3">
                Define how trainer social posts qualify for this campaign.
              </Text>

              <Text className="text-xs text-muted mb-1">Required hashtags</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                value={requiredHashtags}
                onChangeText={setRequiredHashtags}
                placeholder="#BrandTag, #CampaignTag"
                placeholderTextColor={colors.muted}
              />

              <Text className="text-xs text-muted mb-1">Required mentions</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                value={requiredMentions}
                onChangeText={setRequiredMentions}
                placeholder="@brandhandle, @partnerhandle"
                placeholderTextColor={colors.muted}
              />

              <Text className="text-xs text-muted mb-2">Allowed platforms</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const active = allowedPlatforms.includes(platform.value);
                  return (
                    <TouchableOpacity
                      key={platform.value}
                      onPress={() => togglePlatform(platform.value)}
                      className={`px-3 py-2 rounded-full border ${active ? "bg-primary border-primary" : "bg-surface border-border"}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${active ? "Remove" : "Add"} ${platform.label}`}
                    >
                      <Text className={`text-xs font-medium ${active ? "text-background" : "text-foreground"}`}>
                        {platform.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Posting window start</Text>
                  <TextInput
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                    value={postingWindowStart}
                    onChangeText={setPostingWindowStart}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Posting window end</Text>
                  <TextInput
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                    value={postingWindowEnd}
                    onChangeText={setPostingWindowEnd}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>

              <Text className="text-xs text-muted mb-1">Required link slug (optional)</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                value={requiredLinkSlug}
                onChangeText={setRequiredLinkSlug}
                placeholder="campaign-redbull-jb"
                placeholderTextColor={colors.muted}
              />

              <Text className="text-xs text-muted mb-1">Required post count</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                value={requiredPosts}
                onChangeText={setRequiredPosts}
                placeholder="e.g. 3"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />
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
          {isAlreadyTemplate && (
            <View className="px-4 mb-4">
              <SurfaceCard>
                <Text className="text-sm font-semibold text-foreground mb-1">
                  Public Share Link
                </Text>
                {shareUrl ? (
                  <>
                    <Text className="text-xs text-muted mb-2">
                      Share this URL with the brand customer.
                    </Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(shareUrl)}
                      className="rounded-lg border border-border bg-background px-3 py-2 mb-2"
                      accessibilityRole="button"
                      accessibilityLabel="Open campaign share url"
                      testID="template-share-url"
                    >
                      <Text className="text-xs text-primary">{shareUrl}</Text>
                    </TouchableOpacity>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={handleToggleShareEnabled}
                        className="flex-1 py-2 rounded-lg items-center bg-warning/10"
                        accessibilityRole="button"
                        accessibilityLabel={
                          bundle?.publicShareEnabled
                            ? "Disable campaign link"
                            : "Enable campaign link"
                        }
                        testID="template-share-toggle"
                      >
                        <Text className="text-warning font-medium text-sm">
                          {bundle?.publicShareEnabled ? "Disable" : "Enable"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleGenerateShareLink}
                        className="flex-1 py-2 rounded-lg items-center bg-primary/10"
                        accessibilityRole="button"
                        accessibilityLabel="Regenerate campaign link"
                        testID="template-share-regenerate"
                      >
                        <Text className="text-primary font-medium text-sm">Regenerate Link</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleGenerateShareLink}
                    className="py-2 rounded-lg items-center bg-primary/10"
                    accessibilityRole="button"
                    accessibilityLabel="Generate campaign share link"
                    testID="template-share-generate"
                  >
                    <Text className="text-primary font-medium text-sm">Generate Link</Text>
                  </TouchableOpacity>
                )}
              </SurfaceCard>
            </View>
          )}

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
