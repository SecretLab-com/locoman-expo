import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type TabType = "bundles" | "products" | "trainers";

export default function BrowseScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>("bundles");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data using public catalog endpoints
  const { data: bundles = [] } = trpc.catalog.bundles.useQuery();
  const { data: products = [] } = trpc.catalog.products.useQuery();
  const { data: trainers = [] } = trpc.catalog.trainers.useQuery();

  const tabs: { key: TabType; label: string; icon: Parameters<typeof IconSymbol>[0]["name"] }[] = [
    { key: "bundles", label: "Bundles", icon: "rectangle.grid.2x2.fill" },
    { key: "products", label: "Products", icon: "cube.box.fill" },
    { key: "trainers", label: "Trainers", icon: "person.2.fill" },
  ];

  const filteredBundles = bundles.filter((b: any) =>
    b.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter((p: any) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTrainers = trainers.filter((t: any) =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScreenContainer>
      {/* Header with back button */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3"
          activeOpacity={0.7}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground flex-1">Discover</Text>
      </View>

      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-base text-foreground"
            placeholder="Search bundles, products, trainers..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Selector */}
      <View className="flex-row px-4 mb-4">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 flex-row items-center justify-center py-3 mx-1 rounded-xl ${
              activeTab === tab.key ? "bg-primary" : "bg-surface border border-border"
            }`}
            activeOpacity={0.8}
          >
            <IconSymbol
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? "#fff" : colors.muted}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === tab.key ? "text-white" : "text-muted"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {activeTab === "bundles" && (
          <View className="px-4">
            {filteredBundles.length === 0 ? (
              <View className="items-center py-12">
                <IconSymbol name="rectangle.grid.2x2.fill" size={48} color={colors.muted} />
                <Text className="text-muted mt-4">No bundles found</Text>
              </View>
            ) : (
              filteredBundles.map((bundle: any) => (
                <TouchableOpacity
                  key={bundle.id}
                  className="bg-surface border border-border rounded-xl mb-3 overflow-hidden"
                  onPress={() => router.push(`/bundle/${bundle.id}` as any)}
                  activeOpacity={0.8}
                >
                  {bundle.imageUrl && (
                    <Image
                      source={{ uri: bundle.imageUrl }}
                      className="w-full h-40"
                      contentFit="cover"
                    />
                  )}
                  <View className="p-4">
                    <Text className="text-lg font-semibold text-foreground">{bundle.title}</Text>
                    <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                      {bundle.description}
                    </Text>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-lg font-bold text-primary">
                        ${bundle.price?.toFixed(2) || "0.00"}
                      </Text>
                      <View className="flex-row items-center">
                        <IconSymbol name="star.fill" size={14} color={colors.warning} />
                        <Text className="text-sm text-muted ml-1">4.8</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === "products" && (
          <View className="px-4">
            {filteredProducts.length === 0 ? (
              <View className="items-center py-12">
                <IconSymbol name="cube.box.fill" size={48} color={colors.muted} />
                <Text className="text-muted mt-4">No products found</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredProducts.map((product: any) => (
                  <TouchableOpacity
                    key={product.id}
                    className="bg-surface border border-border rounded-xl mb-3 overflow-hidden"
                    style={{ width: "48%" }}
                    activeOpacity={0.8}
                  >
                    {product.images?.[0]?.src && (
                      <Image
                        source={{ uri: product.images[0].src }}
                        className="w-full h-32"
                        contentFit="cover"
                      />
                    )}
                    <View className="p-3">
                      <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                        {product.title}
                      </Text>
                      <Text className="text-sm font-bold text-primary mt-1">
                        ${product.variants?.[0]?.price || "0.00"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "trainers" && (
          <View className="px-4">
            {filteredTrainers.length === 0 ? (
              <View className="items-center py-12">
                <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
                <Text className="text-muted mt-4">No trainers found</Text>
              </View>
            ) : (
              filteredTrainers.map((trainer: any) => (
                <TouchableOpacity
                  key={trainer.id}
                  className="bg-surface border border-border rounded-xl mb-3 p-4 flex-row items-center"
                  onPress={() => router.push(`/trainer/${trainer.id}` as any)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: trainer.photoUrl || "https://i.pravatar.cc/150?img=1" }}
                    className="w-16 h-16 rounded-full"
                  />
                  <View className="flex-1 ml-4">
                    <Text className="text-base font-semibold text-foreground">{trainer.name}</Text>
                    <Text className="text-sm text-muted mt-1" numberOfLines={1}>
                      {trainer.bio || "Fitness Professional"}
                    </Text>
                    <View className="flex-row items-center mt-2">
                      <IconSymbol name="star.fill" size={14} color={colors.warning} />
                      <Text className="text-sm text-muted ml-1">4.9 • 50+ clients</Text>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Bottom padding for tab bar */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
