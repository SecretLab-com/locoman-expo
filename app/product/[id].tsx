import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { sanitizeHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import RenderHTML from "react-native-render-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: products, isLoading } = trpc.catalog.products.useQuery();

  const product = (products || []).find((p: any) => String(p.id) === id);
  const p = product as any;

  return (
    <>
      <Stack.Screen options={{ presentation: "modal", headerShown: false, gestureEnabled: true }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Handle bar */}
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>Product details</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <IconSymbol name="xmark" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !p ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>Product not found.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            {p.imageUrl ? (
              <View style={{ width: "100%", height: 300, backgroundColor: "#fff", padding: 16 }}>
                <Image
                  source={{ uri: p.imageUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={{ width: "100%", height: 160, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="bag.fill" size={48} color={colors.muted} />
              </View>
            )}

            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              {/* Name + Price */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, flex: 1, paddingRight: 12 }}>{p.name}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>${parseFloat(p.price).toFixed(2)}</Text>
                  {p.compareAtPrice && parseFloat(p.compareAtPrice) > parseFloat(p.price) && (
                    <Text style={{ fontSize: 13, color: colors.muted, textDecorationLine: "line-through" }}>${parseFloat(p.compareAtPrice).toFixed(2)}</Text>
                  )}
                </View>
              </View>

              {/* Category + Stock */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                {p.category ? (
                  <View style={{ backgroundColor: `${colors.primary}18`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.primary, textTransform: "capitalize" }}>{p.category}</Text>
                  </View>
                ) : <View />}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.availability === "available" && (p.inventoryQuantity || 0) > 0 ? colors.success : colors.error }} />
                  <Text style={{ fontSize: 12, marginLeft: 6, color: p.availability === "available" && (p.inventoryQuantity || 0) > 0 ? colors.success : colors.error }}>
                    {p.availability === "available" && (p.inventoryQuantity || 0) > 0 ? `${p.inventoryQuantity} in stock` : "Out of stock"}
                  </Text>
                </View>
              </View>

              {/* Description with HTML */}
              {p.description ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>Description</Text>
                  <RenderHTML
                    contentWidth={Math.max(0, width - 40)}
                    source={{ html: sanitizeHtml(p.description) }}
                    tagsStyles={{
                      p: { color: colors.muted, lineHeight: 20, marginTop: 0, marginBottom: 8 },
                      h1: { color: colors.foreground, fontSize: 18, fontWeight: "600", marginBottom: 8 },
                      h2: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 },
                      h3: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 },
                      strong: { color: colors.foreground, fontWeight: "600" },
                      b: { color: colors.foreground, fontWeight: "600" },
                      em: { fontStyle: "italic" },
                      ul: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                      ol: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                      li: { color: colors.muted, marginBottom: 4 },
                    }}
                  />
                </View>
              ) : null}

              {/* Brand / Phase */}
              {(p.brand || p.phase) ? (
                <View style={{ marginBottom: 16 }}>
                  {p.brand && (
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.muted }}>Brand: </Text>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground }}>{p.brand}</Text>
                    </View>
                  )}
                  {p.phase && (
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.muted }}>Phase: </Text>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, textTransform: "capitalize" }}>{p.phase}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Sponsored bonus */}
              {p.isSponsored && p.trainerBonus && (
                <View style={{ backgroundColor: `${colors.success}18`, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" }}>
                  <IconSymbol name="star.fill" size={16} color={colors.success} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.success }}>+${p.trainerBonus} trainer bonus per sale</Text>
                    {p.sponsoredBy && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Sponsored by {p.sponsoredBy}</Text>}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}
