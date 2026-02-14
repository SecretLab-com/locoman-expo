import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type Bundle = {
  id: string;
  title: string;
  price?: string | number;
  status: string;
  sales?: number;
  image?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
};

function BundleCard({ bundle, onPress, onEdit, onDelete }: { 
  bundle: Bundle; 
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "bg-success/20", text: "text-success" };
      case "pending":
        return { bg: "bg-warning/20", text: "text-warning" };
      case "draft":
        return { bg: "bg-muted/20", text: "text-muted" };
      default:
        return { bg: "bg-muted/20", text: "text-muted" };
    }
  };

  const statusStyle = getStatusColor(bundle.status);

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl overflow-hidden mb-4 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row">
        <Image
          source={{ uri: bundle.image || bundle.imageUrl || undefined }}
          className="w-24 h-24"
          contentFit="cover"
        />
        <View className="flex-1 p-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {bundle.title}
              </Text>
              <Text className="text-lg font-bold text-primary mt-1">${Number(bundle.price || 0).toFixed(2)}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${statusStyle.bg}`}>
              <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
                {bundle.status}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center mt-2">
            <IconSymbol name="chart.bar.fill" size={14} color={colors.muted} />
            <Text className="text-sm text-muted ml-1">{bundle.sales || 0} sales</Text>
          </View>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View className="flex-row border-t border-border">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center py-3 border-r border-border"
          onPress={onEdit}
        >
          <IconSymbol name="pencil" size={16} color={colors.primary} />
          <Text className="text-primary font-medium ml-2">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center py-3"
          onPress={onDelete}
        >
          <IconSymbol name="trash.fill" size={16} color={colors.error} />
          <Text className="text-error font-medium ml-2">Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function TrainerBundlesScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "pending">("all");

  // Fetch bundles from tRPC
  const { data: bundlesData, isLoading, refetch, isRefetching } = trpc.bundles.list.useQuery();
  const deleteBundleMutation = trpc.bundles.delete.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const bundles: Bundle[] = (bundlesData || []).map((b: any) => ({
    id: String(b.id),
    title: b.title || "Untitled Bundle",
    price: b.price,
    status: b.status === "published" ? "active" : (b.status === "pending_review" ? "pending" : b.status || "draft"),
    sales: b.sales || 0,
    image: b.imageUrl || b.image,
    imageUrl: b.imageUrl,
    createdAt: b.createdAt,
  }));

  const filteredBundles = bundles.filter((bundle) => {
    if (filter === "all") return true;
    return bundle.status === filter;
  });

  const onRefresh = async () => {
    await refetch();
  };

  const handleBundlePress = (bundle: Bundle) => {
    router.push(`/bundle/${bundle.id}` as any);
  };

  const handleEditBundle = (bundle: Bundle) => {
    router.push(`/bundle-editor/${bundle.id}` as any);
  };

  const handleDeleteBundle = (bundle: Bundle) => {
    Alert.alert(
      "Delete Bundle",
      `Are you sure you want to delete "${bundle.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBundleMutation.mutateAsync({ id: bundle.id });
            } catch (error) {
              console.error("Failed to delete bundle:", error);
              Alert.alert("Error", "Failed to delete bundle. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleCreateBundle = () => {
    router.push("/bundle-editor/new" as any);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold text-foreground">My Bundles</Text>
              <Text className="text-sm text-muted">{bundles.length} total bundles</Text>
            </View>
          </View>
          <TouchableOpacity
            className="bg-primary px-4 py-2 rounded-full flex-row items-center"
            onPress={handleCreateBundle}
          >
            <IconSymbol name="plus" size={18} color={colors.background} />
            <Text className="text-background font-semibold ml-1">New</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1">
          {(["all", "active", "draft", "pending"] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              className={`flex-1 py-2 rounded-lg ${filter === filterOption ? "bg-primary" : ""}`}
              onPress={() => setFilter(filterOption)}
            >
              <Text
                className={`text-center font-medium capitalize ${
                  filter === filterOption ? "text-background" : "text-muted"
                }`}
              >
                {filterOption}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bundle List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <FlatList
        data={filteredBundles}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <BundleCard
            bundle={item}
            onPress={() => handleBundlePress(item)}
            onEdit={() => handleEditBundle(item)}
            onDelete={() => handleDeleteBundle(item)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="bag.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No bundles found</Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full mt-4"
              onPress={handleCreateBundle}
            >
              <Text className="text-background font-semibold">Create Your First Bundle</Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}
    </ScreenContainer>
  );
}
