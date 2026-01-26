import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Bell,
  CreditCard,
  Shield,
  Palette,
  Globe,
  Mail,
  ChevronRight,
  ExternalLink,
  Moon,
  Sun,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Tag,
  Package,
  Users,
  ShoppingBag,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

type SyncItemDetails = {
  synced: number;
  errors: number;
  syncedItems: Array<{ id: number | string; name: string; type?: string }>;
  errorItems: Array<{ id: number | string; name: string; error: string; type?: string }>;
};

type SyncResult = {
  products: SyncItemDetails;
  bundles: SyncItemDetails;
  customers: SyncItemDetails;
};

function ShopifyIntegrationCard() {
  const syncStatus = trpc.shopify.getBundleSyncStatus.useQuery();
  const [localSyncResult, setLocalSyncResult] = useState<SyncResult | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'products' | 'bundles' | 'customers' | null>(null);
  const [currentSyncResultId, setCurrentSyncResultId] = useState<number | null>(null);
  
  // Load last sync result from database
  const lastSyncResultQuery = trpc.shopify.getLastSyncResult.useQuery();
  
  // Generate CSV mutation
  const generateCsvMutation = trpc.shopify.generateSyncCsv.useMutation({
    onSuccess: (data) => {
      // Open the CSV URL in a new tab to download
      window.open(data.url, '_blank');
      toast.success('CSV report generated!');
    },
    onError: (error) => {
      toast.error(`Failed to generate CSV: ${error.message}`);
    },
  });
  
  // Combine local sync result with database result
  type DbSyncedItem = { type: string; id: number | string; name: string };
  type DbErrorItem = { type: string; id: number | string; name: string; error: string };
  const lastSyncResult: SyncResult | null = localSyncResult || (lastSyncResultQuery.data ? {
    products: {
      synced: lastSyncResultQuery.data.productsSynced || 0,
      errors: lastSyncResultQuery.data.productsErrors || 0,
      syncedItems: ((lastSyncResultQuery.data.syncedItems as DbSyncedItem[]) || []).filter(i => i.type === 'product'),
      errorItems: ((lastSyncResultQuery.data.errorItems as DbErrorItem[]) || []).filter(i => i.type === 'product'),
    },
    bundles: {
      synced: lastSyncResultQuery.data.bundlesSynced || 0,
      errors: lastSyncResultQuery.data.bundlesErrors || 0,
      syncedItems: ((lastSyncResultQuery.data.syncedItems as DbSyncedItem[]) || []).filter(i => i.type === 'bundle'),
      errorItems: ((lastSyncResultQuery.data.errorItems as DbErrorItem[]) || []).filter(i => i.type === 'bundle'),
    },
    customers: {
      synced: lastSyncResultQuery.data.customersSynced || 0,
      errors: lastSyncResultQuery.data.customersErrors || 0,
      syncedItems: ((lastSyncResultQuery.data.syncedItems as DbSyncedItem[]) || []).filter(i => i.type === 'customer'),
      errorItems: ((lastSyncResultQuery.data.errorItems as DbErrorItem[]) || []).filter(i => i.type === 'customer'),
    },
  } : null);
  
  const syncResultId = currentSyncResultId || lastSyncResultQuery.data?.id;
  const lastSyncTime = lastSyncResultQuery.data?.createdAt;
  const existingCsvUrl = lastSyncResultQuery.data?.csvFileUrl;
  
  // Comprehensive sync mutation (products, bundles, customers)
  const syncEverythingMutation = trpc.shopify.syncEverything.useMutation({
    onSuccess: (data) => {
      const totalSynced = data.products.synced + data.bundles.synced + data.customers.synced;
      const totalErrors = data.products.errors + data.bundles.errors + data.customers.errors;
      toast.success(
        `Sync complete! ${data.products.synced} products, ${data.bundles.synced} bundles synced.` +
        (totalErrors > 0 ? ` (${totalErrors} errors)` : "")
      );
      setLocalSyncResult(data);
      setCurrentSyncResultId(data.syncResultId);
      syncStatus.refetch();
      lastSyncResultQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const handleSync = () => {
    syncEverythingMutation.mutate();
  };

  const getSyncStatusIcon = (status: string | null | undefined) => {
    switch (status) {
      case "synced":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Shopify Integration</CardTitle>
            <CardDescription>Connected to your Shopify store</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncEverythingMutation.isPending}
            className="gap-1"
          >
            {syncEverythingMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Everything
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.337 3.415c-.103-.11-.254-.166-.405-.166-.151 0-.302.056-.405.166l-2.88 3.08-2.88-3.08c-.103-.11-.254-.166-.405-.166-.151 0-.302.056-.405.166L5.077 6.295c-.103.11-.166.254-.166.405s.063.295.166.405l2.88 3.08-2.88 3.08c-.103.11-.166.254-.166.405s.063.295.166.405l2.88 2.88c.103.11.254.166.405.166.151 0 .302-.056.405-.166l2.88-3.08 2.88 3.08c.103.11.254.166.405.166.151 0 .302-.056.405-.166l2.88-2.88c.103-.11.166-.254.166-.405s-.063-.295-.166-.405l-2.88-3.08 2.88-3.08c.103-.11.166-.254.166-.405s-.063-.295-.166-.405l-2.88-2.88z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">bright-express-dev</p>
              <p className="text-sm text-green-700 dark:text-green-300">Connected</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1"
            onClick={() => window.open('https://admin.shopify.com/store/bright-express-dev', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Open Store
          </Button>
        </div>

        {/* Sync Status */}
        {syncStatus.data && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Published Bundles</span>
              <span className="font-medium">{syncStatus.data.total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                {getSyncStatusIcon("synced")} Synced
              </span>
              <span className="font-medium text-green-600">{syncStatus.data.synced}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                {getSyncStatusIcon("pending")} Pending
              </span>
              <span className="font-medium text-yellow-600">{syncStatus.data.pending}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                {getSyncStatusIcon("failed")} Failed
              </span>
              <span className="font-medium text-red-600">{syncStatus.data.failed}</span>
            </div>
            {syncStatus.data.lastSyncedAt && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Last synced: {new Date(syncStatus.data.lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Last Sync Results */}
        {lastSyncResult && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Last Sync Results</p>
                {lastSyncTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastSyncTime).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  if (existingCsvUrl) {
                    window.open(existingCsvUrl, '_blank');
                  } else if (syncResultId) {
                    generateCsvMutation.mutate({ id: syncResultId });
                  }
                }}
                disabled={generateCsvMutation.isPending || !syncResultId}
              >
                {generateCsvMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Download CSV
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click on any category to see details</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <button 
                onClick={() => { setSelectedCategory('products'); setDetailsDialogOpen(true); }}
                className="p-2 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors cursor-pointer border-2 border-transparent hover:border-primary/20"
              >
                <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold text-lg">{lastSyncResult.products.synced}</p>
                <p className="text-xs text-muted-foreground">Products</p>
                {lastSyncResult.products.errors > 0 && (
                  <p className="text-xs text-red-500 mt-1">{lastSyncResult.products.errors} errors</p>
                )}
              </button>
              <button 
                onClick={() => { setSelectedCategory('bundles'); setDetailsDialogOpen(true); }}
                className="p-2 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors cursor-pointer border-2 border-transparent hover:border-primary/20"
              >
                <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold text-lg">{lastSyncResult.bundles.synced}</p>
                <p className="text-xs text-muted-foreground">Bundles</p>
                {lastSyncResult.bundles.errors > 0 && (
                  <p className="text-xs text-red-500 mt-1">{lastSyncResult.bundles.errors} errors</p>
                )}
              </button>
              <button 
                onClick={() => { setSelectedCategory('customers'); setDetailsDialogOpen(true); }}
                className="p-2 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors cursor-pointer border-2 border-transparent hover:border-primary/20"
              >
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold text-lg">{lastSyncResult.customers.synced}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
                {lastSyncResult.customers.errors > 0 && (
                  <p className="text-xs text-red-500 mt-1">{lastSyncResult.customers.errors} errors</p>
                )}
              </button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Sync Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCategory === 'products' && <Package className="h-5 w-5" />}
              {selectedCategory === 'bundles' && <ShoppingBag className="h-5 w-5" />}
              {selectedCategory === 'customers' && <Users className="h-5 w-5" />}
              {selectedCategory === 'products' && 'Products Sync Details'}
              {selectedCategory === 'bundles' && 'Bundles Sync Details'}
              {selectedCategory === 'customers' && 'Customers Sync Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory && lastSyncResult && (
                <span>
                  {lastSyncResult[selectedCategory].synced} synced successfully
                  {lastSyncResult[selectedCategory].errors > 0 && (
                    <span className="text-red-500"> • {lastSyncResult[selectedCategory].errors} errors</span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCategory && lastSyncResult && (
            <div className="space-y-4">
              {/* Errors Section */}
              {lastSyncResult[selectedCategory].errorItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Errors ({lastSyncResult[selectedCategory].errorItems.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    <div className="space-y-2">
                      {lastSyncResult[selectedCategory].errorItems.map((item, idx) => (
                        <div key={idx} className="text-sm p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.error}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Synced Items Section */}
              {lastSyncResult[selectedCategory].syncedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Synced Successfully ({lastSyncResult[selectedCategory].syncedItems.length})
                  </h4>
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {lastSyncResult[selectedCategory].syncedItems.map((item, idx) => (
                        <div key={idx} className="text-sm p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                          <p className="truncate" title={item.name}>{item.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {lastSyncResult[selectedCategory].syncedItems.length === 0 && lastSyncResult[selectedCategory].errorItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No items were processed in this category.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  if (!setTheme) return <p className="text-sm text-muted-foreground">Theme switching is not available</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-medium">Dark Mode</Label>
          <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
            className="gap-1"
          >
            <Sun className="h-4 w-4" />
            Light
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
            className="gap-1"
          >
            <Moon className="h-4 w-4" />
            Dark
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Current theme: <span className="font-medium capitalize">{theme}</span>
      </p>
    </div>
  );
}

export default function ManagerSettings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState({
    newTrainer: true,
    bundlePublished: true,
    lowInventory: false,
    weeklyReport: true,
  });

  const settingsSections = [
    {
      icon: Tag,
      title: "Tag Management",
      description: "Manage goal and service type tags",
      action: () => setLocation("/manager/tags"),
    },
    {
      icon: Building2,
      title: "Business Profile",
      description: "Company name, logo, and contact info",
      action: () => toast.info("Business profile settings coming soon"),
    },
    {
      icon: Globe,
      title: "Domain & Branding",
      description: "Custom domain and brand colors",
      action: () => toast.info("Domain settings coming soon"),
    },
    {
      icon: CreditCard,
      title: "Billing & Subscription",
      description: "Payment methods and plan details",
      action: () => toast.info("Billing settings coming soon"),
    },
    {
      icon: Shield,
      title: "Security",
      description: "Password, 2FA, and access controls",
      action: () => toast.info("Security settings coming soon"),
    },
  ];

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast.success("Notification preference updated");
  };

  return (
    <AppShell title="Settings">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground dark:text-white">Settings</h1>
          <p className="text-muted-foreground dark:text-muted-foreground">Manage your platform preferences</p>
        </div>

        {/* Quick Settings */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what updates you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="newTrainer" className="font-medium">New trainer applications</Label>
                <p className="text-sm text-muted-foreground">Get notified when trainers apply</p>
              </div>
              <Switch
                id="newTrainer"
                checked={notifications.newTrainer}
                onCheckedChange={() => handleNotificationChange("newTrainer")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="bundlePublished" className="font-medium">Bundle published</Label>
                <p className="text-sm text-muted-foreground">When trainers publish new bundles</p>
              </div>
              <Switch
                id="bundlePublished"
                checked={notifications.bundlePublished}
                onCheckedChange={() => handleNotificationChange("bundlePublished")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="lowInventory" className="font-medium">Low inventory alerts</Label>
                <p className="text-sm text-muted-foreground">When products are running low</p>
              </div>
              <Switch
                id="lowInventory"
                checked={notifications.lowInventory}
                onCheckedChange={() => handleNotificationChange("lowInventory")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="weeklyReport" className="font-medium">Weekly summary</Label>
                <p className="text-sm text-muted-foreground">Performance report every Monday</p>
              </div>
              <Switch
                id="weeklyReport"
                checked={notifications.weeklyReport}
                onCheckedChange={() => handleNotificationChange("weeklyReport")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Settings Menu */}
        <Card className="mb-4">
          <CardContent className="p-0">
            {settingsSections.map((section, index) => (
              <div key={section.title}>
                <button
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 dark:hover:bg-slate-800 transition-colors text-left"
                  onClick={section.action}
                >
                  <div className="w-10 h-10 rounded-full bg-muted dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <section.icon className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground dark:text-white">{section.title}</p>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">{section.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground dark:text-muted-foreground shrink-0" />
                </button>
                {index < settingsSections.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </CardTitle>
            <CardDescription>Theme and display preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceSettings />
          </CardContent>
        </Card>

        {/* Shopify Integration */}
        <ShopifyIntegrationCard />

        {/* Support */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.info("Help center coming soon")}>
              Help Center
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.info("Contact support coming soon")}>
              Contact Support
            </Button>
            <p className="text-xs text-center text-muted-foreground dark:text-muted-foreground pt-2">
              LocoMotivate v1.0.0 • Logged in as {user?.name || "Manager"}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
