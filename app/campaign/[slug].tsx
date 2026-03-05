import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function PublicCampaignPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = trpc.catalog.campaignByShareSlug.useQuery(
    { slug: String(slug || "") },
    { enabled: Boolean(slug) },
  );

  const campaign = query.data;

  return (
    <>
      <Stack.Screen options={{ title: "Campaign", headerShown: false }} />
      <ScreenContainer>
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as any))}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mb-4"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="public-campaign-back"
          >
            <IconSymbol name="arrow.left" size={20} color="#111827" />
          </TouchableOpacity>

          {query.isLoading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-muted mt-3">Loading campaign...</Text>
            </View>
          ) : !campaign ? (
            <View className="bg-surface border border-border rounded-xl p-4">
              <Text className="text-foreground font-semibold">Campaign link unavailable</Text>
              <Text className="text-sm text-muted mt-1">
                This campaign link is disabled or no longer exists.
              </Text>
            </View>
          ) : (
            <View className="bg-surface border border-border rounded-xl p-4">
              <Text className="text-2xl font-bold text-foreground">{campaign.title}</Text>
              {campaign.description ? (
                <Text className="text-sm text-muted mt-2">{campaign.description}</Text>
              ) : null}
              {campaign.price ? (
                <Text className="text-primary font-semibold mt-3">${campaign.price}</Text>
              ) : null}
              {campaign.brands?.length ? (
                <Text className="text-sm text-foreground mt-3">
                  Brand: {campaign.brands.join(", ")}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
