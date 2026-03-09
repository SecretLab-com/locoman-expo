import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { ShareButton } from "@/components/share-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { sanitizeHtml, stripHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useSegments } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import RenderHTML from "react-native-render-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BundleDetailScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const segmentList = segments as string[];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bundleImageLoadFailed, setBundleImageLoadFailed] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const { effectiveRole, isTrainer, isManager, isCoordinator, isClient, isAuthenticated } = useAuthContext();
  const isAdmin = isCoordinator || isManager;
  const isTrainerRoleRoute =
    segmentList.includes("(trainer)") || segmentList.includes("(manager)") || segmentList.includes("(coordinator)");
  const showInviteCta = isTrainerRoleRoute || (isAuthenticated && (isTrainer || isManager || isCoordinator));
  const canPurchase = !showInviteCta && (!isAuthenticated || isClient || effectiveRole === "shopper");

  // Fetch bundle detail and catalog products for image matching
  const { data: rawBundle, isLoading, error, refetch: refetchBundle } = trpc.catalog.bundleDetail.useQuery(
    { id: id || "" },
    { enabled: !!id }
  );
  const { data: catalogProducts = [] } = trpc.catalog.products.useQuery();
  const utils = trpc.useUtils();
  const setBundleStatus = trpc.catalog.setBundleStatus.useMutation({
    onSuccess: async () => {
      await refetchBundle();
      await utils.catalog.bundles.invalidate();
      await utils.catalog.allBundles.invalidate();
      setShowAdminMenu(false);
      Alert.alert("Updated", "Bundle status has been changed.");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  // Build a name->product lookup from catalog for image matching
  const catalogLookup = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of catalogProducts as any[]) {
      if (p?.name) map.set(p.name.trim().toLowerCase(), p);
    }
    return map;
  }, [catalogProducts]);

  // Map API response to component shape
  const bundle = useMemo(() => {
    if (!rawBundle) return null;
    const parseJsonField = (field: any): any[] => {
      if (!field) return [];
      if (typeof field === "string") { try { return JSON.parse(field); } catch { return []; } }
      if (Array.isArray(field)) return field;
      return [];
    };
    const services = parseJsonField(rawBundle.servicesJson);
    const products = parseJsonField(rawBundle.productsJson);
    const goalsRaw = rawBundle.goalsJson;
    const goals = Array.isArray(goalsRaw) ? goalsRaw : [];
    const goalsObj = goalsRaw && typeof goalsRaw === "object" && !Array.isArray(goalsRaw) ? goalsRaw as Record<string, any> : null;
    const sessionCount = goalsObj ? Number(goalsObj.sessionCount || 0) : 0;

    const totalSessionsFromServices = services.reduce((sum: number, s: any) => {
      const n = Number(s?.sessions ?? 0);
      return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    }, 0);
    const resolvedSessionCount = sessionCount || totalSessionsFromServices || null;

    const resolvedProducts = products.map((p: any) => {
      const name = p.name || p.title || p.productName || "";
      const catalogMatch = name ? catalogLookup.get(name.trim().toLowerCase()) : null;
      const imageUrl = normalizeAssetUrl(p.imageUrl) || (catalogMatch ? normalizeAssetUrl(catalogMatch.imageUrl) : null);
      return {
        id: p.id || p.productId || (catalogMatch?.id) || null,
        name,
        price: p.price && parseFloat(p.price) > 0 ? parseFloat(p.price) : (catalogMatch?.price ? parseFloat(catalogMatch.price) : null),
        imageUrl,
        quantity: p.quantity || 1,
      };
    }).filter((p: any) => p.name);

    return {
      id: rawBundle.id,
      title: rawBundle.title,
      description: rawBundle.description || "",
      price: parseFloat(rawBundle.price || "0"),
      image: rawBundle.imageUrl || null,
      rating: (rawBundle as any).rating || 0,
      reviews: (rawBundle as any).reviewCount || 0,
      duration: rawBundle.cadence || "one_time",
      level: (rawBundle as any).level || "All Levels",
      services: services.map((s: any) => {
        if (typeof s === "string") return { name: s, sessions: 0 };
        return { name: s.name || s.title || "", sessions: Number(s.sessions || 0) };
      }).filter((s: any) => s.name),
      products: resolvedProducts,
      goals: goals.map((g: any) => typeof g === "string" ? g : g.name || g.title || "").filter(Boolean),
      sessionCount: resolvedSessionCount,
      totalTrainerBonus: rawBundle.totalTrainerBonus ? parseFloat(rawBundle.totalTrainerBonus) : null,
      status: rawBundle.status || "draft",
      trainerId: rawBundle.trainerId,
    };
  }, [rawBundle, catalogLookup]);

  const bundleImageUrl = useMemo(() => {
    return normalizeAssetUrl(bundle?.image);
  }, [bundle?.image]);

  useEffect(() => {
    setBundleImageLoadFailed(false);
  }, [bundleImageUrl]);

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading bundle...</Text>
      </ScreenContainer>
    );
  }

  if (error || !bundle) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.muted} />
        <Text className="text-xl font-bold text-foreground mt-4">Bundle not found</Text>
        <Text className="text-muted text-center mt-2">
          This bundle may have been removed or is unavailable.
        </Text>
        <TouchableOpacity
          className="mt-4 bg-primary px-6 py-3 rounded-full"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const handleAddToCart = () => {
    Alert.alert("Added to Cart", `${bundle.title} has been added to your cart!`);
  };

  const handleInviteClient = () => {
    const params = {
      bundleId: id,
      bundleTitle: bundle.title,
      bundlePrice: String(bundle.price),
    };

    if (isCoordinator) {
      router.push({ pathname: "/(coordinator)/invite", params } as any);
      return;
    }
    if (isManager) {
      router.push({ pathname: "/(manager)/invite", params } as any);
      return;
    }
    router.push({ pathname: "/(trainer)/invite", params } as any);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {bundleImageUrl && !bundleImageLoadFailed ? (
            <Image
              source={{ uri: bundleImageUrl }}
              className="w-full h-72"
              contentFit="cover"
              transition={120}
              onError={() => setBundleImageLoadFailed(true)}
            />
          ) : (
            <View className="w-full h-72 bg-primary/10 items-center justify-center">
              <IconSymbol name="bag.fill" size={64} color={colors.primary} />
            </View>
          )}
          {/* Back Button */}
          <TouchableOpacity
            className="absolute left-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
            style={{ top: insets.top + 8 }}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Top-right buttons */}
          <View className="absolute right-4 flex-row gap-2" style={{ top: insets.top + 8 }}>
            {isAdmin && (
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
                onPress={() => setShowAdminMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Bundle settings"
                testID="bundle-admin-gear"
              >
                <IconSymbol name="gearshape.fill" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm">
              <ShareButton
                content={{
                  type: "bundle",
                  id: String(bundle.id),
                  title: bundle.title,
                  message: `Check out ${bundle.title} - ${stripHtml(bundle.description).slice(0, 100)}...`,
                }}
                size={20}
                color="#fff"
                className="p-0"
              />
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-1 mr-3">
              <Text className="text-2xl font-bold text-foreground">
                {bundle.title}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-2xl font-bold text-foreground">
                ${bundle.price.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-2">
              <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-primary">Bundle</Text>
              </View>
              {isAdmin && bundle.status !== "published" && (
                <View style={{ backgroundColor: bundle.status === "archived" ? "rgba(248,113,113,0.15)" : "rgba(250,204,21,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: bundle.status === "archived" ? "#F87171" : "#FACC15", textTransform: "capitalize" }}>
                    {bundle.status}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted capitalize">{(bundle.duration || "one_time").replace(/_/g, " ")}</Text>
          </View>

          {bundle.rating > 0 && (
            <View className="flex-row items-center mb-4">
              <IconSymbol name="star.fill" size={14} color={colors.warning} />
              <Text className="text-foreground ml-1 font-medium">{bundle.rating}</Text>
              <Text className="text-muted ml-1">({bundle.reviews} reviews)</Text>
            </View>
          )}

          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
            {bundle.description && /<[a-z][\s\S]*>/i.test(bundle.description) ? (
              <RenderHTML
                contentWidth={Math.max(0, width - 32)}
                source={{ html: sanitizeHtml(bundle.description) }}
                tagsStyles={{
                  p: {
                    color: colors.muted,
                    lineHeight: 20,
                    marginTop: 0,
                    marginBottom: 8,
                  },
                  strong: { color: colors.foreground, fontWeight: "600" },
                  b: { color: colors.foreground, fontWeight: "600" },
                  em: { fontStyle: "italic" },
                  i: { fontStyle: "italic" },
                  ul: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                  ol: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                  li: { color: colors.muted, marginBottom: 4 },
                  h1: { color: colors.foreground, fontSize: 18, fontWeight: "600", marginBottom: 8 },
                  h2: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 },
                  h3: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 },
                }}
              />
            ) : (
              <Text className="text-base text-muted leading-6">{bundle.description}</Text>
            )}
          </View>

          {/* Empty state when no content sections exist */}
          {!bundle.sessionCount && bundle.services.length === 0 && bundle.products.length === 0 && bundle.goals.length === 0 && (
            <View className="mb-5 bg-surface border border-border rounded-xl p-5 items-center">
              <IconSymbol name="cube.box.fill" size={28} color={colors.muted} />
              <Text className="text-muted text-sm text-center mt-3">
                No services or products have been added to this bundle yet.
              </Text>
              {showInviteCta && (
                <TouchableOpacity
                  className="mt-3 bg-primary/10 px-4 py-2 rounded-full"
                  onPress={() => router.push(`/bundle-editor/${bundle.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit this bundle"
                >
                  <Text className="text-primary text-sm font-semibold">Edit Bundle</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Sessions */}
          {bundle.sessionCount && (
            <View className="mb-5 bg-surface border border-border rounded-xl p-4 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <IconSymbol name="calendar" size={18} color={colors.primary} />
              </View>
              <View>
                <Text className="text-foreground font-semibold">{bundle.sessionCount} Sessions</Text>
                <Text className="text-xs text-muted mt-0.5 capitalize">{bundle.duration.replace(/_/g, " ")} cadence</Text>
              </View>
            </View>
          )}

          {/* Services */}
          {bundle.services.length > 0 && (
            <View className="mb-5">
              <Text className="text-sm font-semibold text-foreground mb-3">Services</Text>
              {bundle.services.map((svc: any, i: number) => (
                <View key={i} className="flex-row items-center mb-2.5">
                  <View className="w-8 h-8 rounded-full bg-success/10 items-center justify-center mr-3">
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground">{svc.name}</Text>
                    {svc.sessions > 0 && (
                      <Text className="text-xs text-muted mt-0.5">{svc.sessions} session{svc.sessions !== 1 ? "s" : ""}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Products */}
          {bundle.products.length > 0 && (
            <View className="mb-5">
              <Text className="text-sm font-semibold text-foreground mb-3">Products</Text>
              {bundle.products.map((prod: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  className="flex-row items-center mb-3 bg-surface border border-border rounded-xl p-3"
                  onPress={() => {
                    if (prod.id) router.push(`/product/${prod.id}` as any);
                  }}
                  disabled={!prod.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${prod.name}`}
                >
                  {prod.imageUrl ? (
                    <Image
                      source={{ uri: prod.imageUrl }}
                      style={{ width: 44, height: 44, borderRadius: 8 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="w-11 h-11 rounded-lg bg-primary/10 items-center justify-center">
                      <IconSymbol name="bag.fill" size={18} color={colors.primary} />
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium" numberOfLines={1}>{prod.name}</Text>
                    {prod.quantity > 1 && (
                      <Text className="text-xs text-muted mt-0.5">Qty: {prod.quantity}</Text>
                    )}
                  </View>
                  {prod.price != null && (
                    <Text className="text-foreground font-semibold">${prod.price.toFixed(2)}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Goals */}
          {bundle.goals.length > 0 && (
            <View className="mb-5">
              <Text className="text-sm font-semibold text-foreground mb-3">Goals</Text>
              {bundle.goals.map((goal: string, i: number) => (
                <View key={i} className="flex-row items-center mb-2">
                  <IconSymbol name="star.fill" size={16} color={colors.warning} />
                  <Text className="text-foreground ml-3">{goal}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Trainer Bonus (only for trainers, managers, coordinators) */}
          {showInviteCta && bundle.totalTrainerBonus != null && bundle.totalTrainerBonus > 0 && (
            <View className="mb-5 bg-success/10 border border-success/30 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <IconSymbol name="star.fill" size={18} color={colors.success} />
                <Text className="text-success font-semibold ml-2">Trainer Bonus</Text>
              </View>
              <Text className="text-foreground text-lg font-bold">
                +${bundle.totalTrainerBonus.toFixed(2)} per sale
              </Text>
              <Text className="text-muted text-xs mt-1">
                Bonus is paid in addition to the bundle price
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-4 pb-8">
        {showInviteCta ? (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleInviteClient}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTrainer ? "Invite client to this bundle" : "Assign this bundle to a client"}
            testID="bundle-invite-cta"
          >
            <Text className="text-background font-semibold text-lg">
              {isTrainer ? "Invite Client" : "Assign to Client"}
            </Text>
          </TouchableOpacity>
        ) : canPurchase ? (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleAddToCart}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add bundle to cart"
            testID="bundle-add-to-cart-cta"
          >
            <Text className="text-background font-semibold text-lg">
              Add to Cart - ${bundle.price}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleInviteClient}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTrainer ? "Invite client to this bundle" : "Assign this bundle to a client"}
            testID="bundle-invite-fallback-cta"
          >
            <Text className="text-background font-semibold text-lg">
              {isTrainer ? "Invite Client" : "Assign to Client"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admin Status Management Modal */}
      {isAdmin && (
        <Modal visible={showAdminMenu} transparent animationType="fade" onRequestClose={() => setShowAdminMenu(false)}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" }}>
            <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setShowAdminMenu(false)} />
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: "85%", maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Bundle Settings</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>{bundle?.title}</Text>

              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Current Status</Text>
              <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, textTransform: "capitalize" }}>
                  {bundle?.status?.replace(/_/g, " ") || "unknown"}
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Change Status</Text>

              {bundle?.status !== "published" && (
                <ActionButton
                  variant="primary"
                  loading={setBundleStatus.isPending}
                  onPress={() => setBundleStatus.mutate({ id: id!, status: "published" })}
                  style={{ backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.3)", borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" }}
                  accessibilityLabel="Publish this bundle"
                >
                  <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.success }}>Publish</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Make visible to clients and shoppers</Text>
                  </View>
                </ActionButton>
              )}

              {bundle?.status !== "archived" && (
                <ActionButton
                  variant="danger"
                  loading={setBundleStatus.isPending}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      if (window.confirm("Withdraw Bundle?\n\nThis will hide the bundle from all clients and shoppers. You can re-publish it later.")) {
                        setBundleStatus.mutate({ id: id!, status: "archived" });
                      }
                    } else {
                      Alert.alert("Withdraw Bundle?", "This will hide the bundle from all clients and shoppers. You can re-publish it later.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Withdraw", style: "destructive", onPress: () => setBundleStatus.mutate({ id: id!, status: "archived" }) },
                      ]);
                    }
                  }}
                  style={{ backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.3)", borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" }}
                  accessibilityLabel="Withdraw this bundle"
                >
                  <IconSymbol name="xmark.circle.fill" size={18} color="#F87171" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#F87171" }}>Withdraw</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Hide from platform, can re-publish later</Text>
                  </View>
                </ActionButton>
              )}

              {bundle?.status !== "draft" && (
                <ActionButton
                  variant="ghost"
                  loading={setBundleStatus.isPending}
                  onPress={() => setBundleStatus.mutate({ id: id!, status: "draft" })}
                  style={{ backgroundColor: "rgba(250,204,21,0.12)", borderWidth: 1, borderColor: "rgba(250,204,21,0.3)", borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" }}
                  accessibilityLabel="Revert to draft"
                >
                  <IconSymbol name="pencil" size={18} color="#FACC15" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#FACC15" }}>Revert to Draft</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Unpublish and return to editing state</Text>
                  </View>
                </ActionButton>
              )}

              <TouchableOpacity
                style={{ marginTop: 8, paddingVertical: 12, alignItems: "center" }}
                onPress={() => setShowAdminMenu(false)}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.muted }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}
