import { useState, useMemo } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ActionButton } from "@/components/action-button";
import { useColors } from "@/hooks/use-colors";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";
import { trpc } from "@/lib/trpc";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function TemplatesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilterId, setBrandFilterId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const templatesQuery = trpc.admin.listCampaignTemplates.useQuery({
    search: search || undefined,
    campaignAccountId: brandFilterId || undefined,
  });
  const legacyTemplatesQuery = trpc.admin.templates.useQuery();
  const { data: brandAccounts = [] } = trpc.admin.listCampaignAccounts.useQuery({
    accountType: "brand",
    activeOnly: true,
    limit: 200,
  });
  const updateTemplateMutation = trpc.admin.updateTemplateSettings.useMutation({
    onSuccess: async () => {
      await utils.admin.listCampaignTemplates.invalidate();
    },
  });
  const updateLegacyTemplateMutation = trpc.admin.updateTemplate.useMutation({
    onSuccess: async () => {
      await utils.admin.templates.invalidate();
    },
  });
  const setShareEnabledMutation = trpc.admin.setCampaignShareEnabled.useMutation({
    onSuccess: async () => {
      await utils.admin.listCampaignTemplates.invalidate();
    },
  });
  const templates = templatesQuery.data ?? [];
  const legacyTemplates = legacyTemplatesQuery.data ?? [];

  // Map API data to expected format
  const mappedTemplates = useMemo(() => {
    const promotedRows = templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      createdAt: new Date(t.createdAt),
      isActive: t.templateActive ?? true,
      isPromoted: true,
      primaryBrandName: t.primaryBrandName ?? null,
      publicShareUrl: t.publicShareUrl ?? null,
      publicShareEnabled: Boolean(t.publicShareEnabled),
    }));
    const promotedIds = new Set(promotedRows.map((row) => row.id));
    const legacyRows = legacyTemplates
      .filter((row) => !promotedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        createdAt: new Date(row.createdAt),
        isActive: Boolean(row.active),
        isPromoted: false,
        primaryBrandName: null as string | null,
        publicShareUrl: null as string | null,
        publicShareEnabled: false,
      }));
    const searchTerm = search.trim().toLowerCase();
    const allRows = [...promotedRows, ...legacyRows];
    if (!searchTerm) return allRows;
    return allRows.filter((row) => {
      const haystack = [row.title, row.description, row.primaryBrandName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [templates, legacyTemplates, search]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.admin.listCampaignTemplates.invalidate(),
      utils.admin.templates.invalidate(),
    ]);
    setRefreshing(false);
  };

  // Toggle template active status
  const handleToggleActive = async (template: typeof mappedTemplates[0]) => {
    try {
      if (template.isPromoted) {
        await updateTemplateMutation.mutateAsync({
          bundleId: template.id,
          templateActive: !template.isActive,
        });
      } else {
        await updateLegacyTemplateMutation.mutateAsync({
          id: template.id,
          active: !template.isActive,
        });
      }
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (templatesQuery.isLoading || legacyTemplatesQuery.isLoading) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">
            {CAMPAIGN_COPY.managerListTitle}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">{CAMPAIGN_COPY.managerLoading}</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (templatesQuery.isError || legacyTemplatesQuery.isError) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">
            {CAMPAIGN_COPY.managerListTitle}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">
            {CAMPAIGN_COPY.managerError}
          </Text>
          <Text className="text-muted text-sm mt-2 text-center">
            {templatesQuery.error?.message || legacyTemplatesQuery.error?.message}
          </Text>
          <TouchableOpacity
            onPress={() => {
              templatesQuery.refetch();
              legacyTemplatesQuery.refetch();
            }}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading templates"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">
              {CAMPAIGN_COPY.managerListTitle}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {mappedTemplates.length} {CAMPAIGN_COPY.managerCountSuffix}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-4 mb-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search campaigns or brands..."
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.foreground,
            marginBottom: 8,
          }}
          accessibilityRole="search"
          accessibilityLabel="Search campaigns"
          testID="manager-campaign-search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setBrandFilterId(null)}
              className={`px-3 py-1.5 rounded-full border ${!brandFilterId ? "bg-primary border-primary" : "bg-surface border-border"}`}
              accessibilityRole="button"
              accessibilityLabel="Filter all brands"
              testID="manager-brand-filter-all"
            >
              <Text className={`text-xs font-medium ${!brandFilterId ? "text-background" : "text-foreground"}`}>
                All brands
              </Text>
            </TouchableOpacity>
            {brandAccounts.map((brand: any) => {
              const active = brandFilterId === brand.id;
              return (
                <TouchableOpacity
                  key={brand.id}
                  onPress={() => setBrandFilterId(brand.id)}
                  className={`px-3 py-1.5 rounded-full border ${active ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter ${brand.name}`}
                  testID={`manager-brand-filter-${brand.id}`}
                >
                  <Text className={`text-xs font-medium ${active ? "text-background" : "text-foreground"}`}>
                    {brand.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {mappedTemplates.length === 0 ? (
          <View className="bg-surface rounded-xl border border-border p-6 items-center">
            <IconSymbol name="doc.text.fill" size={36} color={colors.muted} />
            <Text className="text-foreground font-semibold text-base mt-3">
              {CAMPAIGN_COPY.managerNoneTitle}
            </Text>
            <Text className="text-sm text-muted mt-1 text-center">
              {CAMPAIGN_COPY.managerNoneSubtitle}
            </Text>
            <TouchableOpacity
              className="flex-row items-center mt-4"
              onPress={() => router.push("/template-editor/new")}
              accessibilityRole="button"
              accessibilityLabel="Create new campaign"
            >
              <Text className="text-sm text-muted mr-2">Tap the</Text>
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                <IconSymbol name="plus" size={16} color={colors["foreground-inverse"]} />
              </View>
              <Text className="text-sm text-muted ml-2">to get started</Text>
            </TouchableOpacity>
          </View>
        ) : (
          mappedTemplates.map((template) => (
            <TouchableOpacity
              key={template.id}
              className="bg-surface rounded-xl p-4 mb-4 border border-border"
              onPress={() =>
                template.isPromoted
                  ? router.push({
                      pathname: "/(manager)/campaign-dashboard",
                      params: { bundleId: template.id },
                    } as any)
                  : router.push(`/template-editor/${template.id}` as any)
              }
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                template.isPromoted
                  ? `Open campaign detail ${template.title}`
                  : `Open campaign template ${template.title}`
              }
            >
              {/* Header */}
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-foreground">
                      {template.title}
                    </Text>
                    {!template.isActive && (
                      <View className="bg-muted/20 px-2 py-0.5 rounded ml-2">
                        <Text className="text-xs text-muted">Inactive</Text>
                      </View>
                    )}
                  </View>
                  {template.primaryBrandName ? (
                    <Text className="text-xs text-primary mt-1">
                      Brand: {template.primaryBrandName}
                    </Text>
                  ) : (
                    <Text className="text-xs text-warning mt-1">Brand: Not assigned</Text>
                  )}
                </View>
              </View>

              {/* Description */}
              <Text className="text-muted text-sm mb-2">{template.description}</Text>
              {template.publicShareUrl ? (
                <Text className="text-xs text-muted mb-2" numberOfLines={1}>
                  {template.publicShareUrl}
                </Text>
              ) : null}

              <View className="flex-row items-center mb-3 gap-4">
                <View className="flex-row items-center">
                  <IconSymbol name="calendar" size={16} color={colors.muted} />
                  <Text className="text-sm text-muted ml-1">
                    {formatDate(template.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row gap-2 pt-3 border-t border-border">
                <ActionButton
                  onPress={() =>
                    router.push({
                      pathname: "/(manager)/campaign-dashboard",
                      params: { bundleId: template.id },
                    } as any)
                  }
                  className="w-11 py-2 rounded-lg items-center bg-primary/10"
                  accessibilityRole="button"
                  accessibilityLabel="Open campaign detail analytics"
                  testID={`manager-campaign-detail-${template.id}`}
                  disabled={!template.isPromoted}
                >
                  {template.isPromoted ? (
                    <MaterialCommunityIcons
                      name="chart-line"
                      size={16}
                      color={colors.primary}
                    />
                  ) : (
                    <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
                  )}
                </ActionButton>
                  <ActionButton
                    onPress={() => handleToggleActive(template)}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      template.isActive ? "bg-warning/10" : "bg-success/10"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      template.isActive ? "Deactivate campaign" : "Activate campaign"
                    }
                  >
                    <Text
                      className={`font-medium ${
                        template.isActive ? "text-warning" : "text-success"
                      }`}
                    >
                      {template.isActive ? "Deactivate" : "Activate"}
                    </Text>
                  </ActionButton>
                {template.isPromoted ? (
                  <ActionButton
                    onPress={() =>
                      setShareEnabledMutation.mutate({
                        bundleId: template.id,
                        enabled: !template.publicShareEnabled,
                      })
                    }
                    className="flex-1 py-2 rounded-lg items-center bg-warning/10"
                    accessibilityRole="button"
                    accessibilityLabel={
                      template.publicShareEnabled
                        ? "Disable campaign link"
                        : "Enable campaign link"
                    }
                  >
                    <Text className="text-warning font-medium">
                      {template.publicShareEnabled ? "Disable Link" : "Enable Link"}
                    </Text>
                  </ActionButton>
                ) : null}
                {!template.isPromoted ? (
                  <ActionButton
                    onPress={() => router.push(`/template-editor/${template.id}` as any)}
                    className="flex-1 py-2 rounded-lg items-center bg-primary/10"
                    accessibilityRole="button"
                    accessibilityLabel="Edit campaign template"
                  >
                    <Text className="text-primary font-medium">Edit</Text>
                  </ActionButton>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>

      <TouchableOpacity
        onPress={() => router.push("/template-editor/new")}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: 16 }}
        accessibilityRole="button"
        accessibilityLabel="Create new campaign"
        testID="templates-add-fab"
      >
        <IconSymbol name="plus" size={24} color={colors["foreground-inverse"]} />
      </TouchableOpacity>
    </ScreenContainer>
  );
}
