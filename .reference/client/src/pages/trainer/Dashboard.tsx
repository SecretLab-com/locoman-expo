import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Dumbbell,
  Package,
  Users,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Plus,
  Clock,
  Truck,
  MessageSquare,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import {
  StatsGridSkeleton,
  ScheduleSkeleton,
  ActivityFeedSkeleton,
} from "@/components/skeletons";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, X } from "lucide-react";

export default function TrainerDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch trainer stats from API
  const { data: apiStats, isLoading: statsLoading } = trpc.stats.trainer.useQuery(undefined, {
    staleTime: 60000,
  });

  // Fetch upcoming sessions/calendar events
  const { data: calendarEvents } = trpc.calendar.events.useQuery(undefined, {
    staleTime: 30000,
  });

  // Fetch recent activity
  const { data: recentActivity } = trpc.activity.recent.useQuery(
    { limit: 5 },
    { staleTime: 30000 }
  );

  // Fetch recent orders
  const { data: recentOrders } = trpc.orders.recent.useQuery(
    { limit: 3 },
    { staleTime: 30000 }
  );

  // Fetch upcoming deliveries for reminders
  const { data: pendingDeliveries } = trpc.productDeliveries.trainerPending.useQuery();

  // Track dismissed delivery alerts
  const [dismissedDeliveryAlerts, setDismissedDeliveryAlerts] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('dismissedDeliveryAlerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const dismissDeliveryAlert = (deliveryId: number) => {
    const newDismissed = [...dismissedDeliveryAlerts, deliveryId];
    setDismissedDeliveryAlerts(newDismissed);
    localStorage.setItem('dismissedDeliveryAlerts', JSON.stringify(newDismissed));
  };

  // Filter deliveries due within 48 hours that haven't been dismissed
  const upcomingDeliveries = (pendingDeliveries || []).filter(d => {
    if (dismissedDeliveryAlerts.includes(d.id)) return false;
    if (!d.scheduledDate) return false;
    const scheduled = new Date(d.scheduledDate);
    const now = new Date();
    const hoursUntil = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil > 0 && hoursUntil <= 48;
  });

  const utils = trpc.useUtils();

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      utils.stats.trainer.invalidate(),
      utils.calendar.events.invalidate(),
      utils.activity.recent.invalidate(),
      utils.orders.recent.invalidate(),
    ]);
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Calculate stats from API data
  const displayStats = {
    revenue: {
      month: apiStats?.totalRevenue ? Number(apiStats.totalRevenue) : 0,
      change: 23, // Would calculate from historical data
    },
    mrr: apiStats?.activeSubscriptions ? apiStats.activeSubscriptions * 99 : 0,
    clients: {
      active: apiStats?.activeClients ?? 0,
    },
    bundles: {
      published: apiStats?.publishedBundles ?? 0,
    },
    sessions: {
      today: calendarEvents?.filter(e => {
        const eventDate = new Date(e.startTime);
        const today = new Date();
        return eventDate.toDateString() === today.toDateString();
      }).length ?? 0,
    },
  };

  // Format calendar events for today's schedule
  const todaySchedule = calendarEvents
    ?.filter(e => {
      const eventDate = new Date(e.startTime);
      const today = new Date();
      return eventDate.toDateString() === today.toDateString();
    })
    .slice(0, 3)
    .map(e => ({
      id: e.id,
      type: e.eventType || "session",
      time: new Date(e.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      client: e.title,
      description: e.description || e.eventType,
    })) || [];

  // Format recent activity
  const formattedActivity = recentActivity?.map(a => ({
    id: a.id,
    type: a.action,
    message: formatActivityMessage(a.action, a.entityType),
    time: formatTimeAgo(new Date(a.createdAt)),
  })) || [];

  if (loading || statsLoading) {
    return (
      <AppShell title="Dashboard">
        <div className="container py-4">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-9 w-28 bg-muted animate-pulse rounded" />
          </div>

          {/* Stats Grid Skeleton */}
          <StatsGridSkeleton count={5} columns={2} className="mb-6" />

          {/* Schedule Skeleton */}
          <ScheduleSkeleton count={3} className="mb-6" />

          {/* Activity Feed Skeleton */}
          <ActivityFeedSkeleton count={5} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" onRefresh={handleRefresh}>
      <div className="container py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Hi, {user?.name?.split(" ")[0] || "Trainer"}!
            </h1>
            <p className="text-sm text-muted-foreground">Here's your business today</p>
          </div>
          <Button size="sm" onClick={() => setLocation("/trainer/bundles/new")}>
            <Plus className="h-4 w-4 mr-1" />
            New Bundle
          </Button>
        </div>

        {/* Delivery Reminder Alerts */}
        {upcomingDeliveries.length > 0 && (
          <div className="space-y-2 mb-6">
            {upcomingDeliveries.map((delivery) => {
              const scheduled = new Date(delivery.scheduledDate!);
              const now = new Date();
              const hoursUntil = Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60));
              const isUrgent = hoursUntil <= 24;
              
              return (
                <Alert key={delivery.id} className={`relative ${isUrgent ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}>
                  <Bell className={`h-4 w-4 ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`} />
                  <AlertTitle className={`${isUrgent ? 'text-orange-800' : 'text-blue-800'}`}>
                    {isUrgent ? 'Delivery Tomorrow!' : 'Upcoming Delivery'}
                  </AlertTitle>
                  <AlertDescription className={`${isUrgent ? 'text-orange-700' : 'text-blue-700'}`}>
                    <span className="font-medium">{delivery.productName}</span> for{' '}
                    <span className="font-medium">{delivery.clientName}</span>
                    {' - '}
                    {hoursUntil <= 24 
                      ? `in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`
                      : `on ${scheduled.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
                    }
                    <Link href="/trainer/deliveries" className="ml-2 underline hover:no-underline">
                      View Deliveries
                    </Link>
                  </AlertDescription>
                  <button
                    onClick={() => dismissDeliveryAlert(delivery.id)}
                    className={`absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`}
                    title="Dismiss alert"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Alert>
              );
            })}
          </div>
        )}

        {/* Stats Grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                {displayStats.revenue.month > 0 && (
                  <div className="flex items-center text-xs text-green-500">
                    <ArrowUpRight className="h-3 w-3" />
                    +{displayStats.revenue.change}%
                  </div>
                )}
              </div>
              <p className="text-lg font-bold text-foreground">
                ${displayStats.revenue.month.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Revenue (Month)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-foreground">
                ${displayStats.mrr.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">MRR</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-lg font-bold text-foreground">{displayStats.clients.active}</p>
              <p className="text-xs text-muted-foreground">Active Clients</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Package className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-lg font-bold text-foreground">{displayStats.bundles.published}</p>
              <p className="text-xs text-muted-foreground">Published Bundles</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation("/trainer/image-analytics")}
          >
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-lg font-bold text-foreground">Analytics</p>
              <p className="text-xs text-muted-foreground">Image Performance</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Today's Schedule</CardTitle>
                <CardDescription className="text-xs">
                  {displayStats.sessions.today} events today
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/trainer/calendar")}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todaySchedule.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        item.type === "session"
                          ? "bg-blue-100"
                          : item.type === "delivery"
                          ? "bg-green-100"
                          : "bg-purple-100"
                      }`}
                    >
                      {item.type === "session" ? (
                        <Dumbbell className="h-4 w-4 text-blue-600" />
                      ) : item.type === "delivery" ? (
                        <Truck className="h-4 w-4 text-green-600" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{item.client}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.time}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {formattedActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {formattedActivity.map((activity) => {
                  const activityLink = getActivityLink(activity.type);
                  return activityLink ? (
                    <Link 
                      key={activity.id} 
                      href={activityLink}
                      className="flex items-start gap-3 group hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground group-hover:text-primary transition-colors">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                    </Link>
                  ) : (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function getActivityLink(action: string): string | null {
  const links: Record<string, string> = {
    client_added: "/trainer/clients",
    client_active: "/trainer/clients",
    bundle_created: "/trainer/bundles",
    bundle_published: "/trainer/bundles",
    order_created: "/trainer/orders",
    session_completed: "/trainer/calendar",
  };
  return links[action] || null;
}

function formatActivityMessage(action: string, entityType: string | null): string {
  const messages: Record<string, string> = {
    client_added: "New client added",
    client_active: "Client activated",
    bundle_created: "New bundle created",
    bundle_published: "Bundle published",
    order_created: "New order received",
    session_completed: "Session completed",
  };
  return messages[action] || `${action} on ${entityType || "item"}`;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}
