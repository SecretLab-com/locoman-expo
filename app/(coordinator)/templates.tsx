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
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoordinatorTemplatesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showBundlePicker, setShowBundlePicker] = useState(false);
  const utils = trpc.useUtils();

  const { data: promotedTemplates = [], isLoading: templatesLoading } = trpc.admin.promotedTemplates.useQuery();
  const { data: legacyTemplates = [] } = trpc.admin.templates.useQuery();
  const { data: availableBundles = [], isLoading: bundlesLoading } = trpc.admin.nonTemplateBundles.useQuery();

  const demoteMutation = trpc.admin.demoteTemplate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.promotedTemplates.invalidate(),
        utils.admin.nonTemplateBundles.invalidate(),
        utils.bundles.templates.invalidate(),
      ]);
      showAlert("Template Removed", "This bundle is no longer a template.");
    },
    onError: (err) => showAlert("Error", err.message),
  });

  const allTemplates = useMemo(() => {
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
    }));
    return [...promoted, ...legacy];
  }, [promotedTemplates, legacyTemplates]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.admin.promotedTemplates.invalidate(),
      utils.admin.templates.invalidate(),
      utils.admin.nonTemplateBundles.invalidate(),
    ]);
    setRefreshing(false);
  };

  const handleDemote = (template: typeof allTemplates[0]) => {
    if (!template.isPromoted) {
      showAlert("Legacy Template", "This template was created with the old editor and cannot be demoted.");
      return;
    }
    if (Platform.OS === "web") {
      if (window.confirm(`Remove "${template.title}" as a template?\n\nIt will revert to a regular bundle.`)) {
        demoteMutation.mutate({ bundleId: template.id });
      }
    } else {
      Alert.alert("Remove Template", `Remove "${template.title}" as a template? It will revert to a regular bundle.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => demoteMutation.mutate({ bundleId: template.id }) },
      ]);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Templates"
          subtitle={`${allTemplates.length} templates`}
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
          {templatesLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : allTemplates.length === 0 ? (
            <View className="bg-surface rounded-xl border border-border p-6 items-center">
              <IconSymbol name="doc.text.fill" size={36} color={colors.muted} />
              <Text className="text-foreground font-semibold text-base mt-3">No templates yet</Text>
              <Text className="text-sm text-muted mt-1 text-center">
                Create a bundle first, then promote it to a template.
              </Text>
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
            </View>
          ) : (
            allTemplates.map((template) => (
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
                        onPress={() => router.push({ pathname: "/(coordinator)/template-settings", params: { bundleId: template.id } } as any)}
                        className="flex-1 py-2 rounded-lg items-center bg-primary/10"
                        accessibilityRole="button"
                        accessibilityLabel="Edit settings"
                      >
                        <Text className="text-primary font-medium text-sm">Settings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDemote(template)}
                        className="flex-1 py-2 rounded-lg items-center bg-error/10"
                        accessibilityRole="button"
                        accessibilityLabel="Remove template"
                      >
                        <Text className="text-error font-medium text-sm">Remove</Text>
                      </TouchableOpacity>
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
        accessibilityLabel="Promote a bundle to template"
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
            <Text className="text-lg font-semibold text-foreground">Select a Bundle to Promote</Text>
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
    </ScreenContainer>
  );
}
