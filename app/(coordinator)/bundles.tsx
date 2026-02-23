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
  templateId?: string | null;
  brand?: string | null;
};

export default function CoordinatorBundlesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = trpc.catalog.bundles.useQuery();
  const { data: trainersData } = trpc.catalog.trainers.useQuery();
  const { data: templatesData } = trpc.bundles.templates.useQuery();

  const trainersMap = useMemo(() => {
    const map = new Map<string, string>();
    if (trainersData) {
      for (const t of trainersData as any[]) {
        map.set(t.id, t.name || "Unknown Trainer");
      }
    }
    return map;
  }, [trainersData]);

  const bundles: BundleCard[] = useMemo(
    () =>
      (data || []).map((b: any) => ({
        id: String(b.id),
        title: b.title,
        description: b.description,
        price: b.price,
        imageUrl: b.imageUrl,
        trainerId: b.trainerId,
        trainerName: b.trainerName || trainersMap.get(b.trainerId) || "Trainer",
        templateId: b.templateId,
        brand: b.brand || null,
      })),
    [data, trainersMap],
  );

  const uniqueTrainers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of bundles) {
      if (b.trainerId && !seen.has(b.trainerId)) {
        seen.set(b.trainerId, b.trainerName || "Unknown");
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [bundles]);

  const uniqueTemplates = useMemo(() => {
    if (!templatesData) return [];
    return (templatesData as any[]).map((t) => ({ id: t.id, title: t.title }));
  }, [templatesData]);

  const filteredBundles = useMemo(() => {
    let result = bundles;
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          (b.description || "").toLowerCase().includes(term) ||
          (b.trainerName || "").toLowerCase().includes(term),
      );
    }
    if (selectedTrainer) {
      result = result.filter((b) => b.trainerId === selectedTrainer);
    }
    if (selectedTemplate) {
      result = result.filter((b) => b.templateId === selectedTemplate);
    }
    return result;
  }, [bundles, searchQuery, selectedTrainer, selectedTemplate]);

  const hasActiveFilters = Boolean(searchQuery || selectedTrainer || selectedTemplate);
  const activeFilterCount = [searchQuery, selectedTrainer, selectedTemplate].filter(Boolean).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTrainer(null);
    setSelectedTemplate(null);
  };

  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Bundles</Text>
            <Text className="text-sm text-muted mt-1">
              {filteredBundles.length} of {bundles.length} bundles
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="flex-row items-center px-3 py-2 rounded-full border"
            style={{
              borderColor: hasActiveFilters ? colors.primary : colors.border,
              backgroundColor: hasActiveFilters ? `${colors.primary}15` : "transparent",
            }}
            accessibilityRole="button"
            accessibilityLabel="Filter bundles"
            testID="bundles-filter"
          >
            <IconSymbol name="line.3.horizontal.decrease" size={16} color={hasActiveFilters ? colors.primary : colors.muted} />
            {activeFilterCount > 0 && (
              <View className="bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center ml-1.5">
                <Text className="text-white text-[10px] font-bold">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar - always visible */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2.5">
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2.5 text-foreground text-sm"
            placeholder="Search bundles..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <View className="px-4 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {selectedTrainer && (
                <TouchableOpacity
                  onPress={() => setSelectedTrainer(null)}
                  className="flex-row items-center bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5"
                >
                  <Text className="text-xs text-primary font-medium">
                    {uniqueTrainers.find((t) => t.id === selectedTrainer)?.name || "Trainer"}
                  </Text>
                  <IconSymbol name="xmark" size={10} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
              {selectedTemplate && (
                <TouchableOpacity
                  onPress={() => setSelectedTemplate(null)}
                  className="flex-row items-center bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5"
                >
                  <Text className="text-xs text-primary font-medium">
                    {uniqueTemplates.find((t) => t.id === selectedTemplate)?.title || "Template"}
                  </Text>
                  <IconSymbol name="xmark" size={10} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={clearFilters}
                className="flex-row items-center bg-error/10 rounded-full px-3 py-1.5"
              >
                <Text className="text-xs text-error font-medium">Clear all</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-2">Loading bundles...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBundles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex-row"
              onPress={() => router.push(`/bundle/${item.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Review ${item.title}`}
              testID={`bundle-review-${item.id}`}
            >
              <View className="w-16 h-16 rounded-lg bg-muted/30 overflow-hidden mr-3 items-center justify-center">
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="w-16 h-16" contentFit="cover" />
                ) : (
                  <IconSymbol name="shippingbox.fill" size={20} color={colors.muted} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                  {item.trainerName}
                </Text>
                {item.price && (
                  <Text className="text-sm text-primary font-semibold mt-1">
                    ${item.price}
                  </Text>
                )}
              </View>
              <View className="items-center justify-center">
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
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
                <TouchableOpacity className="mt-3 px-4 py-2 border border-border rounded-lg" onPress={clearFilters}>
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
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setShowFilters(false)} />
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="items-center py-2">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(148,163,184,0.55)" }} />
            </View>

            <View className="px-5 pb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Filter Bundles</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5 pb-6" showsVerticalScrollIndicator={false}>
              {/* Trainer filter */}
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-2 mt-2">Trainer</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setSelectedTrainer(null)}
                  className={`px-3 py-2 rounded-full border ${!selectedTrainer ? "bg-primary border-primary" : "bg-surface border-border"}`}
                >
                  <Text className={`text-xs font-medium ${!selectedTrainer ? "text-background" : "text-foreground"}`}>All</Text>
                </TouchableOpacity>
                {uniqueTrainers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSelectedTrainer(selectedTrainer === t.id ? null : t.id)}
                    className={`px-3 py-2 rounded-full border ${selectedTrainer === t.id ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  >
                    <Text className={`text-xs font-medium ${selectedTrainer === t.id ? "text-background" : "text-foreground"}`}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Template filter */}
              {uniqueTemplates.length > 0 && (
                <>
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Template Used</Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    <TouchableOpacity
                      onPress={() => setSelectedTemplate(null)}
                      className={`px-3 py-2 rounded-full border ${!selectedTemplate ? "bg-primary border-primary" : "bg-surface border-border"}`}
                    >
                      <Text className={`text-xs font-medium ${!selectedTemplate ? "text-background" : "text-foreground"}`}>All</Text>
                    </TouchableOpacity>
                    {uniqueTemplates.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                        className={`px-3 py-2 rounded-full border ${selectedTemplate === t.id ? "bg-primary border-primary" : "bg-surface border-border"}`}
                      >
                        <Text className={`text-xs font-medium ${selectedTemplate === t.id ? "text-background" : "text-foreground"}`} numberOfLines={1}>
                          {t.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Apply / Clear */}
              <View className="flex-row gap-3 mt-2 mb-4">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-surface border border-border items-center"
                  onPress={() => { clearFilters(); setShowFilters(false); }}
                >
                  <Text className="text-foreground font-semibold">Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-primary items-center"
                  onPress={() => setShowFilters(false)}
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
