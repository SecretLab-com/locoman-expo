import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserCog, X, ArrowLeft, Zap, ChevronUp, ChevronDown, Clock, Users, History } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback } from "react";

const IMPERSONATION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// Role badge colors
const roleBadgeColors: Record<string, string> = {
  coordinator: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  trainer: "bg-green-100 text-green-700",
  client: "bg-orange-100 text-orange-700",
  shopper: "bg-gray-100 text-gray-700",
};

export function ImpersonationBanner() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [isMinimized, setIsMinimized] = useState(() => {
    // Persist minimized state in sessionStorage
    return sessionStorage.getItem("impersonation-banner-minimized") === "true";
  });
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  
  const { data: status } = trpc.impersonate.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Fetch recent users for quick-switch (only when impersonating)
  const { data: recentUsers } = trpc.impersonate.recentUsers.useQuery(
    { limit: 5 },
    {
      enabled: status?.isImpersonating ?? false,
      refetchOnWindowFocus: false,
    }
  );

  const stopImpersonation = trpc.impersonate.stop.useMutation({
    onSuccess: (result) => {
      // Clear minimized state on exit
      sessionStorage.removeItem("impersonation-banner-minimized");
      // Invalidate all queries to refresh with admin data
      utils.invalidate();
      // Navigate to transition page (shows "Impersonation Ended" then redirects to home)
      navigate("/dev/impersonation-exit");
    },
    onError: (error) => {
      toast.error(`Failed to exit impersonation: ${error.message}`);
    },
  });

  const startImpersonation = trpc.impersonate.start.useMutation({
    onSuccess: (result) => {
      toast.success(`Now impersonating ${result.impersonatedUser.name || result.impersonatedUser.email}`);
      // Invalidate all queries to refresh with new user data
      utils.invalidate();
      // Navigate based on role
      const role = result.impersonatedUser.role;
      if (role === "trainer") {
        navigate("/trainer");
      } else if (role === "client") {
        navigate("/client");
      } else if (role === "manager" || role === "coordinator") {
        navigate("/manager");
      } else {
        navigate("/");
      }
    },
    onError: (error) => {
      toast.error(`Failed to switch user: ${error.message}`);
    },
  });

  // Calculate session start time from status
  const sessionStartTime = useMemo(() => {
    if (status?.startedAt) {
      return new Date(status.startedAt).getTime();
    }
    return null;
  }, [status?.startedAt]);

  // Update time remaining every second
  useEffect(() => {
    if (!sessionStartTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - sessionStartTime;
      const remaining = IMPERSONATION_DURATION_MS - elapsed;

      if (remaining <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Persist minimized state
  const toggleMinimized = useCallback(() => {
    setIsMinimized(prev => {
      const newValue = !prev;
      sessionStorage.setItem("impersonation-banner-minimized", String(newValue));
      return newValue;
    });
  }, []);

  // Handle quick switch to another user
  const handleQuickSwitch = useCallback((userId: number) => {
    startImpersonation.mutate({ userId, notes: "Quick switch from banner" });
  }, [startImpersonation]);

  // Filter out current user from recent users
  const filteredRecentUsers = useMemo(() => {
    if (!recentUsers || !status?.impersonatedUser?.id) return recentUsers || [];
    return recentUsers.filter(u => u.id !== status.impersonatedUser?.id);
  }, [recentUsers, status?.impersonatedUser?.id]);

  // Don't render if not impersonating
  if (!status?.isImpersonating) {
    return null;
  }

  // Minimized state - small floating indicator with dropdown
  if (isMinimized) {
    return (
      <div className="fixed top-2 right-2 z-[100]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full px-3 py-2 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <UserCog className="h-4 w-4" />
              <span className="text-sm font-medium max-w-[120px] truncate">
                {status.impersonatedUser?.name?.split(" ")[0] || "User"}
              </span>
              {timeRemaining && (
                <span className="text-xs text-white/70 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeRemaining}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Current user info */}
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Currently impersonating</p>
                <p className="text-xs text-muted-foreground truncate">
                  {status.impersonatedUser?.name} ({status.impersonatedUser?.role})
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Quick switch section */}
            {filteredRecentUsers.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Quick Switch
                </DropdownMenuLabel>
                {filteredRecentUsers.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleQuickSwitch(user.id)}
                    disabled={startImpersonation.isPending}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                        {user.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeColors[user.role] || "bg-gray-100 text-gray-700"}`}>
                        {user.role}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            
            {/* Actions */}
            <DropdownMenuItem onClick={() => navigate("/dev/impersonate")} className="cursor-pointer">
              <Users className="h-4 w-4 mr-2" />
              All Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleMinimized} className="cursor-pointer">
              <ChevronUp className="h-4 w-4 mr-2" />
              Expand Banner
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => stopImpersonation.mutate()} 
              disabled={stopImpersonation.isPending}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <X className="h-4 w-4 mr-2" />
              {stopImpersonation.isPending ? "Exiting..." : "Exit Impersonation"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          {/* Left side - Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <UserCog className="h-4 w-4" />
              <span className="text-sm font-medium">Impersonating</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-semibold">
                {status.impersonatedUser?.name || status.impersonatedUser?.email || "Unknown User"}
              </span>
              <span className="text-white/70 text-sm">
                ({status.impersonatedUser?.role})
              </span>
            </div>
            {/* Show if this is a role simulation */}
            {status.realAdminUser && (
              <div className="hidden md:flex items-center gap-1 bg-yellow-400/20 text-yellow-100 rounded-full px-2 py-0.5 text-xs">
                <Zap className="h-3 w-3" />
                <span>Testing Mode</span>
              </div>
            )}
            {/* Session timer */}
            {timeRemaining && (
              <div className="hidden lg:flex items-center gap-1 text-white/70 text-xs">
                <Clock className="h-3 w-3" />
                <span>{timeRemaining} remaining</span>
              </div>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {/* Quick switch dropdown in expanded mode */}
            {filteredRecentUsers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 hover:text-white gap-1"
                  >
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Quick Switch</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Recently Impersonated
                  </DropdownMenuLabel>
                  {filteredRecentUsers.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={() => handleQuickSwitch(user.id)}
                      disabled={startImpersonation.isPending}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeColors[user.role] || "bg-gray-100 text-gray-700"}`}>
                          {user.role}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 hover:text-white gap-1"
              onClick={() => navigate("/dev/impersonate")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">All Users</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white text-purple-700 hover:bg-white/90 gap-1"
              onClick={() => stopImpersonation.mutate()}
              disabled={stopImpersonation.isPending}
            >
              <X className="h-4 w-4" />
              <span>{stopImpersonation.isPending ? "Exiting..." : "Exit"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
              onClick={toggleMinimized}
              title="Minimize banner"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check if impersonating (for layout adjustments)
// Returns false when banner is minimized to avoid unnecessary spacing
export function useIsImpersonating() {
  const { data: status } = trpc.impersonate.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [isMinimized, setIsMinimized] = useState(() => {
    return sessionStorage.getItem("impersonation-banner-minimized") === "true";
  });

  // Listen for storage changes to sync minimized state
  useEffect(() => {
    const handleStorage = () => {
      setIsMinimized(sessionStorage.getItem("impersonation-banner-minimized") === "true");
    };
    
    // Check periodically since sessionStorage doesn't fire events in same tab
    const interval = setInterval(handleStorage, 100);
    return () => clearInterval(interval);
  }, []);

  // Return false if minimized (no need for spacing) or not impersonating
  return (status?.isImpersonating && !isMinimized) ?? false;
}
