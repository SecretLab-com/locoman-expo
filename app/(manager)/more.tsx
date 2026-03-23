import { MoreMenuScreen, type MoreMenuItem } from "@/components/more-menu-screen";
import { useBadgeContext } from "@/contexts/badge-context";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";

export default function ManagerMoreScreen() {
  const { counts } = useBadgeContext();

  const items: MoreMenuItem[] = [
    {
      icon: "message.fill",
      title: "Messages",
      subtitle: "Conversations and announcements",
      href: "/(manager)/messages",
      badge: counts.unreadMessages,
    },
    {
      icon: "rectangle.grid.2x2.fill",
      title: CAMPAIGN_COPY.navLabel,
      subtitle: CAMPAIGN_COPY.navSubtitleAdmin,
      href: "/(manager)/templates",
    },
    {
      icon: "shippingbox.fill",
      title: "Bundles",
      subtitle: "Review trainer bundles",
      href: "/(manager)/bundles",
    },
    {
      icon: "checkmark.circle.fill",
      title: "Approvals",
      subtitle: "Review pending approvals",
      href: "/(manager)/approvals",
      badge: counts.pendingApprovals,
    },
    {
      icon: "chart.bar.fill",
      title: "Social Management",
      subtitle: "Program members, KPIs, and concerns",
      href: "/(manager)/social-management",
    },
    {
      icon: "doc.text.fill",
      title: "Payout KYC",
      subtitle: "Track trainer payout onboarding and Adyen status",
      href: "/(manager)/kyc-management",
    },
    {
      icon: "chart.line.uptrend.xyaxis",
      title: "Brand Dashboard",
      subtitle: "Campaign performance by brand and account",
      href: "/(manager)/brand-dashboard",
    },
    {
      icon: "cube.box.fill",
      title: "Deliveries",
      subtitle: "Track delivery status",
      href: "/(manager)/deliveries",
      badge: counts.pendingDeliveries,
    },
    {
      icon: "person.badge.plus",
      title: "Invite",
      subtitle: "Invite trainers and staff",
      href: "/(manager)/invite",
    },
    {
      icon: "gearshape.fill",
      title: "Settings",
      subtitle: "Profile and account settings",
      href: "/(trainer)/settings",
    },
  ];

  return <MoreMenuScreen subtitle="Additional tools and settings." items={items} testIdPrefix="manager-more" />;
}
