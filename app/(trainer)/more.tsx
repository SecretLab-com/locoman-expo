import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColors } from "@/hooks/use-colors";
import { router, Stack } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

type MoreItem = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle: string;
  href: string;
  badge?: number;
};

function MoreRow({
  item,
  iconColor,
  chevronColor,
}: {
  item: MoreItem;
  iconColor: string;
  chevronColor: string;
}) {
  return (
    <TouchableOpacity
      className="rounded-xl"
      onPress={() => router.push(item.href as any)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      testID={`trainer-more-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <SurfaceCard className="px-4 py-4 mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
            <IconSymbol name={item.icon} size={18} color={iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-semibold">{item.title}</Text>
            <Text className="text-sm text-muted mt-0.5">{item.subtitle}</Text>
          </View>
          {item.badge && item.badge > 0 ? (
            <View className="bg-error rounded-full min-w-[22px] h-[22px] items-center justify-center mr-2 px-1.5">
              <Text className="text-white text-xs font-bold">{item.badge > 99 ? "99+" : item.badge}</Text>
            </View>
          ) : null}
          <IconSymbol name="chevron.right" size={16} color={chevronColor} />
        </View>
      </SurfaceCard>
    </TouchableOpacity>
  );
}

export default function TrainerMoreScreen() {
  const colors = useColors();
  const { counts } = useBadgeContext();

  const items: MoreItem[] = [
    {
      icon: "tag.fill",
      title: "Offers",
      subtitle: "Create and manage your offers",
      href: "/(trainer)/offers",
    },
    {
      icon: "rectangle.grid.2x2.fill",
      title: "Templates",
      subtitle: "Browse ready-made offer templates",
      href: "/(trainer)/templates",
    },
    {
      icon: "chart.bar.fill",
      title: "Analytics",
      subtitle: "Earnings over time and top offers",
      href: "/(trainer)/analytics",
    },
    {
      icon: "message.fill",
      title: "Messages",
      subtitle: "Conversations with clients",
      href: "/(trainer)/messages",
      badge: counts.unreadMessages,
    },
    {
      icon: "sparkles",
      title: "AI Assistant",
      subtitle: "Chat, automate tasks, and use voice instructions",
      href: "/(trainer)/assistant",
    },
    {
      icon: "bell.fill",
      title: "Alerts",
      subtitle: "Orders, deliveries, and activity",
      href: "/(trainer)/alerts",
      badge: counts.pendingJoinRequests,
    },
    {
      icon: "person.badge.plus",
      title: "Invite Clients",
      subtitle: "Invite by email or link",
      href: "/(trainer)/invite",
    },
    {
      icon: "shippingbox.fill",
      title: "Deliveries",
      subtitle: "Track delivery status",
      href: "/(trainer)/deliveries",
      badge: counts.pendingDeliveries,
    },
    {
      icon: "calendar",
      title: "Calendar",
      subtitle: "Manage your training sessions",
      href: "/(trainer)/calendar",
    },
    {
      icon: "gearshape.fill",
      title: "Settings",
      subtitle: "Profile and account settings",
      href: "/(trainer)/settings",
    },
  ];

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader title="More" subtitle="Advanced tools live here." />

          <View className="px-4 pb-8">
            {items.map((item) => (
              <MoreRow
                key={item.title}
                item={item}
                iconColor={colors.primary}
                chevronColor={colors.muted}
              />
            ))}
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
