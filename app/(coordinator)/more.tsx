import { MoreMenuScreen, type MoreMenuItem } from "@/components/more-menu-screen";
import { useBadgeContext } from "@/contexts/badge-context";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";

export default function CoordinatorMoreScreen() {
  const { counts } = useBadgeContext();

  const items: MoreMenuItem[] = [
    {
      icon: "message.fill",
      title: "Messages",
      subtitle: "Conversations and announcements",
      href: "/(coordinator)/messages",
      badge: counts.unreadMessages,
    },
    {
      icon: "rectangle.grid.2x2.fill",
      title: CAMPAIGN_COPY.navLabel,
      subtitle: CAMPAIGN_COPY.navSubtitleAdmin,
      href: "/(coordinator)/templates",
    },
    {
      icon: "shippingbox.fill",
      title: "Bundles",
      subtitle: "Review trainer bundles",
      href: "/(coordinator)/bundles",
    },
    {
      icon: "checkmark.circle.fill",
      title: "Approvals",
      subtitle: "Review pending approvals",
      href: "/(coordinator)/approvals",
      badge: counts.pendingApprovals,
    },
    {
      icon: "bell.fill",
      title: "Alerts",
      subtitle: "Notifications and activity",
      href: "/(coordinator)/alerts",
    },
    {
      icon: "cube.box.fill",
      title: "Deliveries",
      subtitle: "Track delivery status",
      href: "/(coordinator)/deliveries",
      badge: counts.pendingDeliveries,
    },
    {
      icon: "doc.text.fill",
      title: "Logs",
      subtitle: "System activity log",
      href: "/(coordinator)/logs",
    },
    {
      icon: "chart.bar.fill",
      title: "Social Management",
      subtitle: "Program members, KPIs, and concerns",
      href: "/(coordinator)/social-management",
    },
    {
      icon: "doc.text.fill",
      title: "Payout KYC",
      subtitle: "Track trainer payout onboarding and Adyen status",
      href: "/(coordinator)/kyc-management",
    },
    {
      icon: "chart.line.uptrend.xyaxis",
      title: "Brand Dashboard",
      subtitle: "Campaign performance by brand and account",
      href: "/(coordinator)/brand-dashboard",
    },
    {
      icon: "person.badge.plus",
      title: "Invite",
      subtitle: "Invite trainers and staff",
      href: "/(coordinator)/invite",
    },
    {
      icon: "gearshape.fill",
      title: "Settings",
      subtitle: "Profile and account settings",
      href: "/(trainer)/settings",
    },
  ];

  return <MoreMenuScreen subtitle="Additional tools and settings." items={items} testIdPrefix="coordinator-more" />;
}
