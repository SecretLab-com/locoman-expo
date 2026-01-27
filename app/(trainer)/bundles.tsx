import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock data for trainer's bundles
const MOCK_BUNDLES = [
  {
    id: 1,
    title: "Full Body Transformation",
    price: 149.99,
    status: "active",
    sales: 45,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    title: "HIIT Cardio Blast",
    price: 79.99,
    status: "active",
    sales: 32,
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400",
    createdAt: "2024-02-20",
  },
  {
    id: 3,
    title: "Yoga for Beginners",
    price: 59.99,
    status: "draft",
    sales: 0,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
    createdAt: "2024-03-10",
  },
  {
    id: 4,
    title: "Strength Training 101",
    price: 99.99,
    status: "pending",
    sales: 0,
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400",
    createdAt: "2024-03-15",
  },
];

type Bundle = (typeof MOCK_BUNDLES)[0];

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
          source={{ uri: bundle.image }}
          className="w-24 h-24"
          contentFit="cover"
        />
        <View className="flex-1 p-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {bundle.title}
              </Text>
              <Text className="text-lg font-bold text-primary mt-1">${bundle.price}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${statusStyle.bg}`}>
              <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
                {bundle.status}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center mt-2">
            <IconSymbol name="chart.bar.fill" size={14} color={colors.muted} />
            <Text className="text-sm text-muted ml-1">{bundle.sales} sales</Text>
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
  const [bundles, setBundles] = useState(MOCK_BUNDLES);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "pending">("all");

  const filteredBundles = bundles.filter((bundle) => {
    if (filter === "all") return true;
    return bundle.status === filter;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
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
          onPress: () => {
            setBundles((prev) => prev.filter((b) => b.id !== bundle.id));
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
      <FlatList
        data={filteredBundles}
        keyExtractor={(item) => item.id.toString()}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
    </ScreenContainer>
  );
}
