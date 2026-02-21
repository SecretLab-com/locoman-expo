import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export default function TemplateGalleryScreen() {
  const colors = useColors();
  const {
    data: templates = [],
    isLoading,
    isRefetching,
    refetch,
  } = trpc.bundles.templates.useQuery();

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <ScreenHeader
            title="Template Gallery"
            subtitle="Browse ready-made offer templates."
            leftSlot={
              <TouchableOpacity
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(trainer)/offers" as any)
                }
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
            {isLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : templates.length === 0 ? (
              <View className="bg-surface rounded-xl border border-border p-6 items-center">
                <IconSymbol name="rectangle.grid.2x2.fill" size={36} color={colors.muted} />
                <Text className="text-foreground font-semibold text-base mt-3">
                  No templates available yet
                </Text>
                <Text className="text-sm text-muted mt-1 text-center">
                  Templates will appear here once your manager creates them.
                </Text>
                <TouchableOpacity
                  className="flex-row items-center mt-4"
                  onPress={() => router.push("/(trainer)/offers/new" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Create new offer"
                >
                  <Text className="text-sm text-muted mr-2">Tap the</Text>
                  <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                    <IconSymbol name="plus" size={16} color="#fff" />
                  </View>
                  <Text className="text-sm text-muted ml-2">to create an offer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              templates.map((template: any) => {
                const goalLabel = template.goalType
                  ? String(template.goalType).replaceAll("_", " ")
                  : null;
                const serviceCount = countItems(template.defaultServices);
                const productCount = countItems(template.defaultProducts);
                const usageCount = Number(template.usageCount || 0);

                return (
                  <TouchableOpacity
                    key={template.id}
                    className="mb-3"
                    onPress={() =>
                      router.push({
                        pathname: "/(trainer)/offers/new",
                        params: { templateId: template.id },
                      } as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${template.title} template`}
                    testID={`template-card-${template.id}`}
                  >
                    <View className="bg-surface border border-border rounded-xl overflow-hidden">
                      {template.imageUrl ? (
                        <Image
                          source={{ uri: template.imageUrl }}
                          style={{ width: "100%", height: 160 }}
                          contentFit="cover"
                        />
                      ) : null}
                      <View className="p-4">
                      <View className="flex-row items-start justify-between mb-1">
                        <Text className="text-foreground font-semibold text-base flex-1 pr-3">
                          {template.title}
                        </Text>
                        {goalLabel && (
                          <View
                            className="rounded-full px-2.5 py-0.5"
                            style={{
                              backgroundColor: `${colors.primary}18`,
                              borderWidth: 1,
                              borderColor: `${colors.primary}40`,
                            }}
                          >
                            <Text
                              className="text-[11px] font-semibold capitalize"
                              style={{ color: colors.primary }}
                            >
                              {goalLabel}
                            </Text>
                          </View>
                        )}
                      </View>

                      {template.description ? (
                        <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                          {template.description}
                        </Text>
                      ) : null}

                      <View className="flex-row items-center flex-wrap gap-x-4 gap-y-1 mt-3">
                        {template.basePrice ? (
                          <View className="flex-row items-center">
                            <IconSymbol name="dollarsign.circle.fill" size={13} color={colors.success} />
                            <Text className="text-xs text-muted ml-1">
                              From {template.basePrice} GBP
                            </Text>
                          </View>
                        ) : null}
                        {serviceCount > 0 && (
                          <View className="flex-row items-center">
                            <IconSymbol name="calendar" size={13} color={colors.muted} />
                            <Text className="text-xs text-muted ml-1">
                              {serviceCount} {serviceCount === 1 ? "service" : "services"}
                            </Text>
                          </View>
                        )}
                        {productCount > 0 && (
                          <View className="flex-row items-center">
                            <IconSymbol name="bag.fill" size={13} color={colors.muted} />
                            <Text className="text-xs text-muted ml-1">
                              {productCount} {productCount === 1 ? "product" : "products"}
                            </Text>
                          </View>
                        )}
                        {usageCount > 0 && (
                          <View className="flex-row items-center">
                            <IconSymbol name="person.2.fill" size={13} color={colors.muted} />
                            <Text className="text-xs text-muted ml-1">
                              Used {usageCount} {usageCount === 1 ? "time" : "times"}
                            </Text>
                          </View>
                        )}
                        {template.discountType && template.discountValue && (
                          <View className="flex-row items-center">
                            <IconSymbol name="tag.fill" size={13} color={colors.success} />
                            <Text className="text-xs text-success ml-1">
                              {template.discountType === "percentage"
                                ? `${template.discountValue}% off`
                                : `£${template.discountValue} off`}
                            </Text>
                          </View>
                        )}
                        {template.availabilityEnd && (
                          <View className="flex-row items-center">
                            <IconSymbol name="clock" size={13} color={colors.warning} />
                            <Text className="text-xs text-warning ml-1">
                              Expires {new Date(template.availabilityEnd).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                        <Text className="text-sm font-semibold text-primary">Use Template</Text>
                        <IconSymbol name="arrow.right" size={16} color={colors.primary} />
                      </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      <TouchableOpacity
        onPress={() => router.push("/(trainer)/offers/new" as any)}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: 16 }}
        accessibilityRole="button"
        accessibilityLabel="Create new offer"
        testID="templates-create-offer-fab"
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </TouchableOpacity>
      </ScreenContainer>
    </>
  );
}
