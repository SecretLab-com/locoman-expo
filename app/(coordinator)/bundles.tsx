import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type BundleCard = {
  id: string;
  title: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  trainerId?: string | null;
  trainerName?: string | null;
  trainerPhotoUrl?: string | null;
  templateId?: string | null;
  brandName?: string | null;
};

export default function CoordinatorBundlesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const bundlesQuery = trpc.admin.publishedBundlesWithMeta.useQuery();
  const catalogBundlesQuery = trpc.catalog.bundles.useQuery(undefined, {
    enabled: !bundlesQuery.data && !bundlesQuery.isLoading,
  });
  const trainersQuery = trpc.catalog.trainers.useQuery();
  const { data: templatesData } = trpc.bundles.templates.useQuery();

  const trainerPhotoById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const trainer of (trainersQuery.data || []) as any[]) {
      map.set(String(trainer.id), trainer.photoUrl || null);
    }
    return map;
  }, [trainersQuery.data]);

  const bundles: BundleCard[] = useMemo(
    () =>
      (
        (bundlesQuery.data && bundlesQuery.data.length > 0
          ? bundlesQuery.data
          : catalogBundlesQuery.data) || []
      ).map((b: any) => ({
        id: String(b.id || ""),
        title: b.title || "Untitled Bundle",
        description: b.description || null,
        price: b.price || null,
        imageUrl: b.imageUrl || null,
        trainerId: b.trainerId || null,
        trainerName: b.trainerName || "Trainer",
        trainerPhotoUrl:
          b.trainerPhotoUrl || trainerPhotoById.get(String(b.trainerId || "")) || null,
        templateId: b.templateId || null,
        brandName: b.brandName || b.brand || null,
      })),
    [bundlesQuery.data, catalogBundlesQuery.data, trainerPhotoById],
  );

  const uniqueTemplates = useMemo(() => {
    if (!templatesData) return [];
    return (templatesData as any[]).map((t) => ({ id: t.id, title: t.title }));
  }, [templatesData]);

  const uniqueTrainers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const bundle of bundles) {
      if (!bundle.trainerId) continue;
      if (!seen.has(bundle.trainerId)) seen.set(bundle.trainerId, bundle.trainerName || "Trainer");
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bundles]);

  const uniqueBrands = useMemo(() => {
    return Array.from(
      new Set(
        bundles
          .map((bundle) => String(bundle.brandName || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [bundles]);

  const filteredBundles = useMemo(() => {
    let result = bundles;
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          (b.description || "").toLowerCase().includes(term) ||
          (b.trainerName || "").toLowerCase().includes(term) ||
          (b.brandName || "").toLowerCase().includes(term),
      );
    }
    if (selectedTrainer) {
      result = result.filter((b) => b.trainerId === selectedTrainer);
    }
    if (selectedBrand) {
      result = result.filter((b) => b.brandName === selectedBrand);
    }
    if (selectedTemplate) {
      result = result.filter((b) => b.templateId === selectedTemplate);
    }
    return result;
  }, [bundles, searchQuery, selectedTrainer, selectedBrand, selectedTemplate]);
  const hasActiveFilters = Boolean(searchQuery || selectedTrainer || selectedBrand || selectedTemplate);
  const activeFilterCount = [selectedTrainer, selectedBrand, selectedTemplate].filter(Boolean).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([bundlesQuery.refetch(), catalogBundlesQuery.refetch()]);
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTrainer(null);
    setSelectedBrand(null);
    setSelectedTemplate(null);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Offers" subtitle={`${filteredBundles.length} of ${bundles.length} offers`} />

      {/* Search bar - always visible */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-surface border border-border rounded-xl px-4 py-2.5">
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              className="flex-1 ml-2.5 text-foreground text-sm"
              placeholder="Search offers..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              accessibilityLabel="Search offers"
              testID="bundles-search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="h-11 w-11 rounded-xl border items-center justify-center"
            style={{
              borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
              backgroundColor: activeFilterCount > 0 ? `${colors.primary}22` : colors.surface,
            }}
            accessibilityRole="button"
            accessibilityLabel="Open bundle filters"
            testID="bundles-open-filters"
          >
            <IconSymbol
              name="line.3.horizontal.decrease"
              size={16}
              color={activeFilterCount > 0 ? colors.primary : colors.muted}
            />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-[16px] h-[16px] items-center justify-center">
                <Text className="text-white text-[10px] font-bold">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {bundlesQuery.isLoading && !catalogBundlesQuery.data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-2">Loading offers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBundles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mb-3 bg-surface border border-border rounded-xl overflow-hidden"
              onPress={() => router.push(`/(coordinator)/bundle/${item.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Open offer ${item.title}`}
              testID={`bundle-row-${item.id}`}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: "100%", height: 110 }}
                  contentFit="cover"
                />
              ) : null}
              <View className="px-4 py-3 flex-row items-center">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    {item.trainerPhotoUrl ? (
                      <Image
                        source={{ uri: item.trainerPhotoUrl }}
                        style={{ width: 18, height: 18, borderRadius: 9, marginRight: 6 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          marginRight: 6,
                          backgroundColor: `${colors.muted}33`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
                          {(item.trainerName || "T").trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs text-muted" numberOfLines={1}>
                      {item.trainerName || "Trainer"}
                      {item.brandName ? ` • ${item.brandName}` : ""}
                    </Text>
                  </View>
                  {item.price && (
                    <Text className="text-sm text-primary font-semibold mt-1">
                      ${item.price}
                    </Text>
                  )}
                </View>
                <View className="items-center justify-center">
                  <IconSymbol name="chevron.right" size={18} color={colors.muted} />
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing || bundlesQuery.isRefetching || catalogBundlesQuery.isRefetching
              }
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
              <Text className="text-foreground font-semibold mt-4">
                {hasActiveFilters ? "No matching bundles" : "No bundles yet"}
              </Text>
              <Text className="text-muted mt-2 text-center">
                {hasActiveFilters ? "Try adjusting your filters." : "Tap the + to create a bundle."}
              </Text>
              {hasActiveFilters && (
              <TouchableOpacity
                className="mt-3 px-4 py-2 border border-border rounded-lg"
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear bundle filters"
              >
                  <Text className="text-foreground text-sm">Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push("/bundle-editor/new?admin=1" as any)}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: 16 }}
        accessibilityRole="button"
        accessibilityLabel="Create new bundle"
        testID="bundles-add-fab"
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Filter modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" }}>
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
            accessibilityRole="button"
            accessibilityLabel="Close filter panel"
          />
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "72%" }}>
            <View className="items-center py-2">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
            </View>

            <View className="px-5 pb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Filters</Text>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5 pb-6" showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-2 mt-2">
                Trainer
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setSelectedTrainer(null)}
                  className={`px-3 py-2 rounded-full border ${!selectedTrainer ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  accessibilityRole="button"
                  accessibilityLabel="Filter all trainers"
                >
                  <Text className={`text-xs font-medium ${!selectedTrainer ? "text-background" : "text-foreground"}`}>All</Text>
                </TouchableOpacity>
                {uniqueTrainers.map((trainer) => (
                  <TouchableOpacity
                    key={trainer.id}
                    onPress={() => setSelectedTrainer(selectedTrainer === trainer.id ? null : trainer.id)}
                    className={`px-3 py-2 rounded-full border ${selectedTrainer === trainer.id ? "bg-primary border-primary" : "bg-surface border-border"}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter trainer ${trainer.name}`}
                  >
                    <Text className={`text-xs font-medium ${selectedTrainer === trainer.id ? "text-background" : "text-foreground"}`}>
                      {trainer.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Brand
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setSelectedBrand(null)}
                  className={`px-3 py-2 rounded-full border ${!selectedBrand ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  accessibilityRole="button"
                  accessibilityLabel="Filter all brands"
                >
                  <Text className={`text-xs font-medium ${!selectedBrand ? "text-background" : "text-foreground"}`}>All</Text>
                </TouchableOpacity>
                {uniqueBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    onPress={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                    className={`px-3 py-2 rounded-full border ${selectedBrand === brand ? "bg-primary border-primary" : "bg-surface border-border"}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter brand ${brand}`}
                  >
                    <Text className={`text-xs font-medium ${selectedBrand === brand ? "text-background" : "text-foreground"}`}>
                      {brand}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Template
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setSelectedTemplate(null)}
                  className={`px-3 py-2 rounded-full border ${!selectedTemplate ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  accessibilityRole="button"
                  accessibilityLabel="Filter all templates"
                >
                  <Text className={`text-xs font-medium ${!selectedTemplate ? "text-background" : "text-foreground"}`}>All</Text>
                </TouchableOpacity>
                {uniqueTemplates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    onPress={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
                    className={`px-3 py-2 rounded-full border ${selectedTemplate === template.id ? "bg-primary border-primary" : "bg-surface border-border"}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter template ${template.title}`}
                  >
                    <Text className={`text-xs font-medium ${selectedTemplate === template.id ? "text-background" : "text-foreground"}`} numberOfLines={1}>
                      {template.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row gap-3 mt-2 mb-4">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-surface border border-border items-center"
                  onPress={() => {
                    clearFilters();
                    setShowFilters(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                >
                  <Text className="text-foreground font-semibold">Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-primary items-center"
                  onPress={() => setShowFilters(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Apply filters"
                >
                  <Text className="text-background font-semibold">Apply</Text>
                </TouchableOpacity>
              </View>

              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
