import { useAuth } from "@/_core/hooks/useAuth";
import { UserAvatar } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import { useCart } from "@/contexts/CartContext";
import { Dumbbell, LogOut, Settings, ShoppingCart, User, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import { useIsImpersonating } from "@/components/ImpersonationBanner";

interface TopHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function TopHeader({ title }: TopHeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const isImpersonating = useIsImpersonating();
  const { itemCount } = useCart();

  const handleLogout = async () => {
    await logout();
    // Force a full page reload to clear any cached auth state
    window.location.href = "/";
  };

  return (
    <header className={`sticky z-40 bg-card border-b border-border ${isImpersonating ? 'top-12' : 'top-0'}`}>
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setLocation("/")}
        >
          {title === "Manager" ? (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-lg">
              👤
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="font-bold text-lg text-foreground">
            {title || "LocoMotivate"}
          </span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Cart Button - always visible */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setLocation("/cart")}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Button>

          {/* User Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserAvatar
                    photoUrl={user?.photoUrl}
                    name={user?.name}
                    size="sm"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || "Shopper"}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/expo')} className="text-violet-600">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Mobile App (Beta)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => setLocation("/login")}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopHeader;
