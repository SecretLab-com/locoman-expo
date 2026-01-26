import { BottomTabNav } from "./BottomTabNav";
import { TopHeader } from "./TopHeader";
import { useIsImpersonating } from "./ImpersonationBanner";
import { PullToRefresh } from "./PullToRefresh";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
  /** Enable pull-to-refresh functionality */
  onRefresh?: () => Promise<void>;
}

export function AppShell({
  children,
  title,
  hideHeader = false,
  hideBottomNav = false,
  onRefresh,
}: AppShellProps) {
  const isImpersonating = useIsImpersonating();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Spacer for impersonation banner */}
      {isImpersonating && <div className="h-12 shrink-0" />}

      {/* Top Header */}
      {!hideHeader && <TopHeader title={title} />}

      {/* Main Content - with padding for fixed elements */}
      <main className={`flex-1 overflow-y-auto ${!hideBottomNav ? "pb-20" : ""}`}>
        {onRefresh ? (
          <PullToRefresh onRefresh={onRefresh} className="h-full">
            {children}
          </PullToRefresh>
        ) : (
          children
        )}
      </main>

      {/* Bottom Tab Navigation */}
      {!hideBottomNav && <BottomTabNav />}
    </div>
  );
}

export default AppShell;
