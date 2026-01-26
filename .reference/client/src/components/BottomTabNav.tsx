import { useAuth } from "@/_core/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { skipToken } from "@tanstack/react-query";
import {
  Home,
  Package,
  ShoppingBag,
  ShoppingCart,
  User,
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings,
  ClipboardCheck,
  DollarSign,
  Star,
  Truck,
  Mail,
} from "lucide-react";
import { useLocation } from "wouter";
import { triggerHaptic } from "@/hooks/useHaptic";

type BadgeType = "cart" | "approvals" | "joinRequests" | "invitations";

type TabConfig = {
  icon: React.ElementType;
  label: string;
  path: string;
  badgeType?: BadgeType;
};

const shopperTabs: TabConfig[] = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Package, label: "Bundles", path: "/catalog" },
  { icon: ShoppingBag, label: "Products", path: "/products" },
  { icon: ShoppingCart, label: "Cart", path: "/cart", badgeType: "cart" },
  { icon: User, label: "Profile", path: "/profile" },
];

const trainerTabs: TabConfig[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/trainer" },
  { icon: Package, label: "Bundles", path: "/trainer/bundles" },
  { icon: DollarSign, label: "Earnings", path: "/trainer/earnings" },
  { icon: Star, label: "Status", path: "/trainer/status" },
  { icon: Users, label: "Clients", path: "/trainer/clients", badgeType: "joinRequests" },
];

const managerTabs: TabConfig[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/manager" },
  { icon: ClipboardCheck, label: "Approvals", path: "/manager/approvals", badgeType: "approvals" },
  { icon: Truck, label: "Deliveries", path: "/manager/deliveries" },
  { icon: Users, label: "Users", path: "/manager/users" },
  { icon: Settings, label: "Settings", path: "/manager/settings" },
];

const clientTabs: TabConfig[] = [
  { icon: Home, label: "Home", path: "/client" },
  { icon: Package, label: "My Bundles", path: "/client/bundles" },
  { icon: Truck, label: "Deliveries", path: "/client/deliveries" },
  { icon: Users, label: "Trainers", path: "/trainers" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomTabNav() {
  const { user, isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const [location, setLocation] = useLocation();

  // Fetch pending approvals count for managers only
  // Use skipToken to completely prevent the query from running for non-managers
  const isManager = user?.role === "manager" || user?.role === "coordinator";
  const { data: pendingBundles } = trpc.admin.pendingBundles.useQuery(
    isManager ? undefined : skipToken,
    {
      staleTime: 30000,
      refetchInterval: 60000,
    }
  );

  // Fetch pending join requests for trainers only
  // Use skipToken to completely prevent the query from running for non-trainers
  const isTrainer = user?.role === "trainer";
  const { data: joinRequests } = trpc.joinRequests.listForTrainer.useQuery(
    isTrainer ? undefined : skipToken,
    {
      staleTime: 30000,
      refetchInterval: 60000,
    }
  );

  // Fetch pending invitations for managers only
  const { data: pendingInvitations } = trpc.admin.getAllInvitations.useQuery(
    isManager ? undefined : skipToken,
    {
      staleTime: 30000,
      refetchInterval: 60000,
    }
  );

  // Calculate badge counts
  const pendingApprovalsCount = pendingBundles?.length || 0;
  const pendingJoinRequestsCount = joinRequests?.filter((r) => r.status === "pending").length || 0;
  const pendingInvitationsCount = pendingInvitations?.filter((i) => i.status === "pending").length || 0;

  // Get badge count for a specific badge type
  const getBadgeCount = (badgeType?: BadgeType): number => {
    switch (badgeType) {
      case "cart":
        return itemCount;
      case "approvals":
        return pendingApprovalsCount;
      case "joinRequests":
        return pendingJoinRequestsCount;
      case "invitations":
        return pendingInvitationsCount;
      default:
        return 0;
    }
  };

  // Determine which tabs to show based on user role
  const getTabs = (): TabConfig[] => {
    if (!isAuthenticated || !user) {
      return shopperTabs;
    }

    switch (user.role) {
      case "trainer":
        return trainerTabs;
      case "manager":
      case "coordinator":
        return managerTabs;
      case "client":
        return clientTabs;
      default:
        return shopperTabs;
    }
  };

  const tabs = getTabs();

  // Check if a tab is active (handles nested routes)
  const isActive = (path: string): boolean => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          const badgeCount = getBadgeCount(tab.badgeType);
          const showBadge = badgeCount > 0;

          return (
            <button
              key={tab.path}
              onClick={() => {
                triggerHaptic('light');
                setLocation(tab.path);
              }}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {showBadge && (
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1",
                    tab.badgeType === "approvals" ? "bg-amber-500" :
                    tab.badgeType === "invitations" ? "bg-blue-500" : "bg-red-500"
                  )}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className={cn("text-xs", active ? "font-medium" : "font-normal")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomTabNav;
