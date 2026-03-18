import { useState, useMemo } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useColors } from "@/hooks/use-colors";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";
import { confirm, notify } from "@/lib/dialogs";
import { trpc } from "@/lib/trpc";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoordinatorTemplatesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showBundlePicker, setShowBundlePicker] = useState(false);
  const [showBrandFilter, setShowBrandFilter] = useState(false);
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: promotedTemplates = [], isLoading: templatesLoading } = trpc.admin.promotedTemplates.useQuery();
  const { data: campaignRows = [] } = trpc.admin.listCampaignTemplates.useQuery();
  const { data: legacyTemplates = [] } = trpc.admin.templates.useQuery();
  const { data: availableBundles = [], isLoading: bundlesLoading } = trpc.admin.nonTemplateBundles.useQuery();

  const demoteMutation = trpc.admin.demoteTemplate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.promotedTemplates.invalidate(),
        utils.admin.nonTemplateBundles.invalidate(),
        utils.bundles.templates.invalidate(),
      ]);
      notify(
        CAMPAIGN_COPY.coordinatorTemplateRemovedTitle,
        CAMPAIGN_COPY.coordinatorTemplateRemovedBody,
      );
    },
    onError: (err) => notify("Error", err.message),
  });

  const allTemplates = useMemo(() => {
    const promotedBrandById = new Map(
      (campaignRows || []).map((row: any) => [String(row.id), row.primaryBrandName || null]),
    );
    const promoted = promotedTemplates.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      price: t.price,
      imageUrl: t.imageUrl ?? null,
      isPromoted: true,
      isActive: t.templateActive ?? true,
      discountType: t.discountType,
      discountValue: t.discountValue,
      availabilityStart: t.availabilityStart,
      availabilityEnd: t.availabilityEnd,
      visibility: t.templateVisibility ?? [],
      createdAt: t.createdAt,
      primaryBrandName: promotedBrandById.get(String(t.id)) || null,
    }));
    const legacy = legacyTemplates.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      price: t.basePrice,
      imageUrl: t.imageUrl ?? null,
      isPromoted: false,
      isActive: t.active,
      discountType: null,
      discountValue: null,
      availabilityStart: null,
      availabilityEnd: null,
      visibility: [],
      createdAt: t.createdAt,
      primaryBrandName: null,
    }));
    return [...promoted, ...legacy];
  }, [promotedTemplates, legacyTemplates, campaignRows]);

  const uniqueBrands = useMemo(() => {
    return Array.from(
      new Set(
        allTemplates
          .map((template) => String(template.primaryBrandName || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [allTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!selectedBrandName) return allTemplates;
    return allTemplates.filter(
      (template) => String(template.primaryBrandName || "").trim() === selectedBrandName,
    );
  }, [allTemplates, selectedBrandName]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.admin.promotedTemplates.invalidate(),
      utils.admin.templates.invalidate(),
      utils.admin.nonTemplateBundles.invalidate(),
    ]);
    setRefreshing(false);
  };

  const handleDemote = async (template: typeof allTemplates[0]) => {
    if (!template.isPromoted) {
      notify("Legacy Template", "This template was created with the old editor and cannot be demoted.");
      return;
    }
    const shouldRemove = await confirm({
      title: "Remove Template",
      message: `Remove "${template.title}" as a template? It will revert to a regular bundle.`,
      confirmText: "Remove",
      destructive: true,
    });
    if (shouldRemove) {
      demoteMutation.mutate({ bundleId: template.id });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title={CAMPAIGN_COPY.coordinatorTitle}
          subtitle={`${filteredTemplates.length} of ${allTemplates.length} campaigns`}
          leftSlot={
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace("/(coordinator)/more" as any)}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="templates-back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-8">
          <View className="flex-row items-center justify-end mb-3">
            <TouchableOpacity
              onPress={() => setShowBrandFilter(true)}
              className="flex-row items-center px-3 py-1.5 rounded-full border"
              style={{
                borderColor: selectedBrandName ? colors.primary : colors.border,
                backgroundColor: selectedBrandName ? `${colors.primary}20` : colors.surface,
              }}
              accessibilityRole="button"
              accessibilityLabel="Filter campaigns by brand"
              testID="campaign-brand-filter-open"
            >
              <IconSymbol
                name="line.3.horizontal.decrease"
                size={14}
                color={selectedBrandName ? colors.primary : colors.muted}
              />
              <Text
                className="text-xs font-medium ml-1.5"
                style={{ color: selectedBrandName ? colors.primary : colors.muted }}
              >
                {selectedBrandName ? selectedBrandName : "Brand"}
              </Text>
            </TouchableOpacity>
          </View>
          {templatesLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTemplates.length === 0 ? (
            <View className="bg-surface rounded-xl border border-border p-6 items-center">
              <IconSymbol name="doc.text.fill" size={36} color={colors.muted} />
              <Text className="text-foreground font-semibold text-base mt-3">
                {selectedBrandName ? "No campaigns for this brand" : "No campaigns yet"}
              </Text>
              <Text className="text-sm text-muted mt-1 text-center">
                {selectedBrandName
                  ? "Try another brand filter or clear the filter."
                  : "Create a bundle first, then promote it to a campaign."}
              </Text>
              {selectedBrandName ? (
                <TouchableOpacity
                  className="mt-4 px-4 py-2 rounded-lg border border-border bg-surface"
                  onPress={() => setSelectedBrandName(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear brand filter"
                  testID="campaign-brand-filter-clear"
                >
                  <Text className="text-sm text-foreground font-medium">Clear brand filter</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center mt-4"
                  onPress={() => setShowBundlePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Promote a bundle"
                >
                  <Text className="text-sm text-muted mr-2">Tap the</Text>
                  <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                    <IconSymbol name="plus" size={16} color="#fff" />
                  </View>
                  <Text className="text-sm text-muted ml-2">to promote a bundle</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredTemplates.map((template) => (
              <View key={template.id} className="mb-3">
                <View className="bg-surface border border-border rounded-xl overflow-hidden">
                  {template.imageUrl ? (
                    <Image
                      source={{ uri: template.imageUrl }}
                      style={{ width: "100%", height: 140 }}
                      contentFit="cover"
                    />
                  ) : null}
                  <TouchableOpacity
                    className="p-4"
                    onPress={() => {
                      if (template.isPromoted) {
                        router.push({ pathname: "/(coordinator)/template-settings", params: { bundleId: template.id } } as any);
                      } else {
                        router.push(`/template-editor/${template.id}` as any);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${template.title}`}
                  >
                    <View className="flex-row items-start justify-between mb-1">
                      <Text className="text-foreground font-semibold text-base flex-1 pr-3">{template.title}</Text>
                      {!template.isActive && (
                        <View className="bg-muted/20 px-2 py-0.5 rounded">
                          <Text className="text-xs text-muted">Inactive</Text>
                        </View>
                      )}
                    </View>
                    {template.description ? (
                      <Text className="text-sm text-muted mt-1" numberOfLines={2}>{template.description}</Text>
                    ) : null}
                    {template.primaryBrandName ? (
                      <Text className="text-xs text-primary mt-1">
                        Brand: {template.primaryBrandName}
                      </Text>
                    ) : null}
                    <View className="flex-row items-center flex-wrap gap-x-4 gap-y-1 mt-2">
                      {template.price && (
                        <Text className="text-xs text-primary font-semibold">${template.price}</Text>
                      )}
                      {template.discountType && template.discountValue && (
                        <View className="flex-row items-center">
                          <IconSymbol name="tag.fill" size={12} color={colors.success} />
                          <Text className="text-xs text-success ml-1">
                            {template.discountType === "percentage" ? `${template.discountValue}% off` : `£${template.discountValue} off`}
                          </Text>
                        </View>
                      )}
                      {template.availabilityEnd && (
                        <Text className="text-xs text-muted">Expires {formatDate(template.availabilityEnd)}</Text>
                      )}
                      <Text className="text-xs text-muted">{formatDate(template.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>

                  {template.isPromoted && (
                    <View className="flex-row gap-2 pt-3 mt-3 border-t border-border px-4 pb-4">
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(coordinator)/campaign-dashboard",
                            params: { bundleId: template.id },
                          } as any)
                        }
                        className="w-11 py-2 rounded-lg items-center bg-primary/10"
                        accessibilityRole="button"
                        accessibilityLabel="Open campaign analytics"
                        testID={`coordinator-campaign-analytics-${template.id}`}
                      >
                        <MaterialCommunityIcons
                          name="chart-line"
                          size={16}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(coordinator)/template-settings", params: { bundleId: template.id } } as any)}
                        className="flex-1 py-2 rounded-lg items-center bg-primary/10"
                        accessibilityRole="button"
                        accessibilityLabel="Edit settings"
                      >
                        <Text className="text-primary font-medium text-sm">Settings</Text>
                      </TouchableOpacity>
                      <ActionButton
                        onPress={() => handleDemote(template)}
                        loading={demoteMutation.isPending}
                        loadingText="Removing..."
                        variant="danger"
                        className="flex-1 py-2 rounded-lg items-center bg-error/10"
                        accessibilityLabel="Remove template"
                        testID="remove-template"
                      >
                        Remove
                      </ActionButton>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB - opens bundle picker */}
      <TouchableOpacity
        onPress={() => setShowBundlePicker(true)}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: 16 }}
        accessibilityRole="button"
                accessibilityLabel="Promote a bundle to campaign"
        testID="templates-promote-fab"
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Bundle picker modal */}
      <Modal
        visible={showBundlePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBundlePicker(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-lg font-semibold text-foreground">
                  Select a Bundle to Promote as Campaign
                </Text>
            <TouchableOpacity onPress={() => setShowBundlePicker(false)}>
              <IconSymbol name="xmark" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {bundlesLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : availableBundles.length === 0 ? (
              <View className="items-center py-12">
                <IconSymbol name="shippingbox.fill" size={40} color={colors.muted} />
                <Text className="text-foreground font-semibold mt-3">No bundles available</Text>
                <Text className="text-sm text-muted mt-1 text-center">
                  Create a bundle first from the Bundles screen, then promote it here.
                </Text>
                <TouchableOpacity
                  className="bg-primary px-5 py-2.5 rounded-full mt-4"
                  onPress={() => {
                    setShowBundlePicker(false);
                    router.push("/bundle-editor/new?admin=1" as any);
                  }}
                >
                  <Text className="text-background font-semibold">Create Bundle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              availableBundles.map((bundle: any) => (
                <TouchableOpacity
                  key={bundle.id}
                  className="bg-surface border border-border rounded-xl p-4 mb-3 flex-row items-center"
                  onPress={() => {
                    setShowBundlePicker(false);
                    router.push({ pathname: "/(coordinator)/template-settings", params: { bundleId: bundle.id } } as any);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Promote ${bundle.title}`}
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{bundle.title}</Text>
                    {bundle.description && (
                      <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>{bundle.description}</Text>
                    )}
                    {bundle.price && (
                      <Text className="text-xs text-primary font-semibold mt-1">${bundle.price}</Text>
                    )}
                  </View>
                  <IconSymbol name="arrow.right" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showBrandFilter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBrandFilter(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.75)" }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowBrandFilter(false)}
          />
          <View className="bg-background rounded-t-3xl p-4" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">Filter by Brand</Text>
              <TouchableOpacity
                onPress={() => setShowBrandFilter(false)}
                accessibilityRole="button"
                accessibilityLabel="Close brand filter"
                testID="campaign-brand-filter-close"
              >
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedBrandName(null);
                  setShowBrandFilter(false);
                }}
                className="py-3 border-b border-border"
                accessibilityRole="button"
                accessibilityLabel="Show all brands"
                testID="campaign-brand-filter-all"
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: selectedBrandName ? colors.foreground : colors.primary }}
                >
                  All brands
                </Text>
              </TouchableOpacity>
              {uniqueBrands.map((brandName) => (
                <TouchableOpacity
                  key={brandName}
                  onPress={() => {
                    setSelectedBrandName(brandName);
                    setShowBrandFilter(false);
                  }}
                  className="py-3 border-b border-border"
                  accessibilityRole="button"
                  accessibilityLabel={`Filter brand ${brandName}`}
                  testID={`campaign-brand-filter-${brandName.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: selectedBrandName === brandName ? colors.primary : colors.foreground,
                    }}
                  >
                    {brandName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
