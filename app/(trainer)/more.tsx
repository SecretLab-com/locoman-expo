import { MoreMenuScreen, type MoreMenuItem } from "@/components/more-menu-screen";
import { useBadgeContext } from "@/contexts/badge-context";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";

export default function TrainerMoreScreen() {
  const { counts } = useBadgeContext();

  const items: MoreMenuItem[] = [
    {
      icon: "tag.fill",
      title: "Bundles",
      subtitle: "Create and manage your bundles",
      href: "/(trainer)/offers",
    },
    {
      icon: "rectangle.grid.2x2.fill",
      title: CAMPAIGN_COPY.navLabel,
      subtitle: CAMPAIGN_COPY.navSubtitleTrainer,
      href: "/(trainer)/templates",
    },
    {
      icon: "chart.bar.fill",
      title: "Analytics",
      subtitle: "Earnings over time and top bundles",
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
      subtitle: "Orders, deliveries, join requests, and notifications",
      href: "/(trainer)/alerts",
      badge: counts.pendingDeliveries + counts.pendingJoinRequests,
    },
    {
      icon: "storefront.fill",
      title: "Create Plan",
      subtitle: "Choose a client first, then build their plan",
      href: "/(trainer)/clients",
    },
    {
      icon: "cart.fill",
      title: "Review & Send",
      subtitle: "Review, save, and send the current plan",
      href: "/(trainer)/cart",
    },
    {
      icon: "person.badge.plus",
      title: "Add Clients",
      subtitle: "Create a client, then send a bundle or custom plan",
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
      icon: "star.fill",
      title: "Rewards",
      subtitle: "Points and status progress",
      href: "/(trainer)/rewards",
    },
    {
      icon: "gearshape.fill",
      title: "Settings",
      subtitle: "Profile and account settings",
      href: "/(trainer)/settings",
    },
  ];

  return <MoreMenuScreen subtitle="Advanced tools live here." items={items} testIdPrefix="trainer-more" />;
}
