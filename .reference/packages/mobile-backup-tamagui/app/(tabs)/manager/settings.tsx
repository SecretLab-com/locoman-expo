import { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Settings,
  Store,
  RefreshCw,
  ExternalLink,
  Download,
  CheckCircle,
  AlertCircle,
  Package,
  Users,
  ShoppingBag,
  Clock,
  ChevronRight,
  Bell,
  Shield,
  Palette,
  HelpCircle,
} from '@tamagui/lucide-icons';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SwitchField } from '@/components/ui/Switch';
import { ResponsiveDialog } from '@/components/ui/Dialog';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Sync result item
interface SyncResultItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  onPress?: () => void;
}

function SyncResultItem({ icon, label, count, onPress }: SyncResultItemProps) {
  return (
    <XStack 
      alignItems="center" 
      gap="$3" 
      padding="$3"
      borderRadius="$2"
      backgroundColor="$muted"
      pressStyle={onPress ? { opacity: 0.8 } : undefined}
      onPress={onPress}
    >
      {icon}
      <Text flex={1} fontSize="$3" color="$color">{label}</Text>
      <Badge variant="secondary">{count}</Badge>
      {onPress && <ChevronRight size={16} color="$mutedForeground" />}
    </XStack>
  );
}

// Settings section
interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600" color="$color">{title}</Text>
      {children}
    </YStack>
  );
}

// Settings row
interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingsRow({ icon, title, description, onPress, rightElement }: SettingsRowProps) {
  return (
    <Card pressable={!!onPress} onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <YStack 
            backgroundColor="$muted" 
            padding="$2" 
            borderRadius="$2"
          >
            {icon}
          </YStack>
          <YStack flex={1}>
            <Text fontSize="$3" fontWeight="500" color="$color">{title}</Text>
            {description && (
              <Text fontSize="$2" color="$mutedForeground">{description}</Text>
            )}
          </YStack>
          {rightElement || (onPress && <ChevronRight size={20} color="$mutedForeground" />)}
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function ManagerSettings() {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [syncDetailsType, setSyncDetailsType] = useState<'products' | 'bundles' | 'customers'>('products');

  // Fetch last sync result
  const { 
    data: lastSync, 
    isLoading: syncLoading,
    refetch: refetchSync,
  } = trpc.manager.getLastSyncResult.useQuery();

  // Fetch settings
  const { 
    data: settings, 
    refetch: refetchSettings,
  } = trpc.manager.getSettings.useQuery();

  // Sync mutation
  const syncShopify = trpc.manager.syncShopify.useMutation({
    onSuccess: (data) => {
      toast.success('Sync complete', `Synced ${data.products} products, ${data.bundles} bundles, ${data.customers} customers`);
      refetchSync();
    },
    onError: (error) => {
      toast.error('Sync failed', error.message);
    },
  });

  // Update settings mutation
  const updateSettings = trpc.manager.updateSettings.useMutation({
    onSuccess: () => {
      toast.success('Settings updated');
      refetchSettings();
    },
    onError: (error) => {
      toast.error('Failed to update settings', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSync(), refetchSettings()]);
    setRefreshing(false);
  };

  const handleSync = () => {
    syncShopify.mutate();
  };

  const handleOpenStore = () => {
    if (settings?.shopifyStoreName) {
      Linking.openURL(`https://${settings.shopifyStoreName}.myshopify.com/admin`);
    }
  };

  const handleSyncDetailsPress = (type: 'products' | 'bundles' | 'customers') => {
    setSyncDetailsType(type);
    setSyncDetailsOpen(true);
  };

  const handleDownloadCSV = () => {
    // In a real app, this would download the CSV
    toast.info('Download started', 'Your CSV file is being prepared.');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        flex={1}
        backgroundColor="$background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <YStack padding="$4" gap="$6">
          {/* Header */}
          <YStack>
            <Text fontSize="$7" fontWeight="700" color="$color">Settings</Text>
            <Text fontSize="$3" color="$mutedForeground">
              Manage your store and preferences
            </Text>
          </YStack>

          {/* Shopify Integration */}
          <SettingsSection title="Shopify Integration">
            <Card>
              <CardHeader>
                <XStack alignItems="center" gap="$2">
                  <Store size={20} color="$primary" />
                  <CardTitle>Store Connection</CardTitle>
                </XStack>
                <CardDescription>
                  {settings?.shopifyStoreName 
                    ? `Connected to ${settings.shopifyStoreName}`
                    : 'Connect your Shopify store'}
                </CardDescription>
              </CardHeader>
              <CardContent gap="$3">
                <XStack gap="$2">
                  <Button 
                    flex={1}
                    variant="outline"
                    leftIcon={<ExternalLink size={16} />}
                    onPress={handleOpenStore}
                    disabled={!settings?.shopifyStoreName}
                  >
                    Open Store
                  </Button>
                  <Button 
                    flex={1}
                    leftIcon={<RefreshCw size={16} />}
                    onPress={handleSync}
                    loading={syncShopify.isPending}
                  >
                    Sync Now
                  </Button>
                </XStack>

                {/* Last Sync Results */}
                {syncLoading ? (
                  <Skeleton height={120} />
                ) : lastSync ? (
                  <YStack gap="$2" marginTop="$2">
                    <XStack alignItems="center" gap="$2">
                      {lastSync.success ? (
                        <CheckCircle size={16} color="$success" />
                      ) : (
                        <AlertCircle size={16} color="$error" />
                      )}
                      <Text fontSize="$2" color="$mutedForeground">
                        Last synced: {new Date(lastSync.syncedAt).toLocaleString()}
                      </Text>
                    </XStack>
                    <YStack gap="$2">
                      <SyncResultItem
                        icon={<Package size={16} color="$primary" />}
                        label="Products"
                        count={lastSync.productsCount || 0}
                        onPress={() => handleSyncDetailsPress('products')}
                      />
                      <SyncResultItem
                        icon={<ShoppingBag size={16} color="$success" />}
                        label="Bundles"
                        count={lastSync.bundlesCount || 0}
                        onPress={() => handleSyncDetailsPress('bundles')}
                      />
                      <SyncResultItem
                        icon={<Users size={16} color="$warning" />}
                        label="Customers"
                        count={lastSync.customersCount || 0}
                        onPress={() => handleSyncDetailsPress('customers')}
                      />
                    </YStack>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      leftIcon={<Download size={14} />}
                      onPress={handleDownloadCSV}
                    >
                      Download CSV Report
                    </Button>
                  </YStack>
                ) : (
                  <YStack padding="$3" alignItems="center">
                    <Text color="$mutedForeground">No sync history</Text>
                  </YStack>
                )}
              </CardContent>
            </Card>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection title="Notifications">
            <Card>
              <CardContent gap="$4">
                <SwitchField
                  label="New Trainer Applications"
                  description="Get notified when trainers apply"
                  checked={settings?.notifications?.newTrainers ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings.mutate({ 
                      notifications: { ...settings?.notifications, newTrainers: checked } 
                    })
                  }
                />
                <Separator />
                <SwitchField
                  label="Bundle Submissions"
                  description="Get notified when bundles are submitted for review"
                  checked={settings?.notifications?.bundleSubmissions ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings.mutate({ 
                      notifications: { ...settings?.notifications, bundleSubmissions: checked } 
                    })
                  }
                />
                <Separator />
                <SwitchField
                  label="Order Updates"
                  description="Get notified about new orders"
                  checked={settings?.notifications?.orders ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings.mutate({ 
                      notifications: { ...settings?.notifications, orders: checked } 
                    })
                  }
                />
              </CardContent>
            </Card>
          </SettingsSection>

          {/* General Settings */}
          <SettingsSection title="General">
            <SettingsRow
              icon={<Palette size={18} color="$mutedForeground" />}
              title="Appearance"
              description="Theme and display settings"
              onPress={() => {}}
            />
            <SettingsRow
              icon={<Shield size={18} color="$mutedForeground" />}
              title="Security"
              description="Password and authentication"
              onPress={() => {}}
            />
            <SettingsRow
              icon={<HelpCircle size={18} color="$mutedForeground" />}
              title="Help & Support"
              description="Get help and contact support"
              onPress={() => {}}
            />
          </SettingsSection>

          {/* App Info */}
          <YStack alignItems="center" gap="$1" paddingVertical="$4">
            <Text fontSize="$2" color="$mutedForeground">LocoMotivate v1.0.0</Text>
            <Text fontSize="$1" color="$mutedForeground">© 2024 LocoMotivate</Text>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Sync Details Dialog */}
      <ResponsiveDialog
        open={syncDetailsOpen}
        onOpenChange={setSyncDetailsOpen}
        title={`${syncDetailsType.charAt(0).toUpperCase() + syncDetailsType.slice(1)} Sync Details`}
        description={`Details from the last sync operation`}
      >
        <YStack gap="$3" maxHeight={400}>
          <ScrollView>
            {lastSync?.details?.[syncDetailsType]?.length ? (
              lastSync.details[syncDetailsType].map((item: any, index: number) => (
                <XStack
                  key={index}
                  padding="$2"
                  borderBottomWidth={1}
                  borderBottomColor="$borderColor"
                  alignItems="center"
                  gap="$2"
                >
                  {item.success ? (
                    <CheckCircle size={14} color="$success" />
                  ) : (
                    <AlertCircle size={14} color="$error" />
                  )}
                  <Text flex={1} fontSize="$2" color="$color">
                    {item.name || item.title || item.email}
                  </Text>
                  {item.error && (
                    <Text fontSize="$1" color="$error">{item.error}</Text>
                  )}
                </XStack>
              ))
            ) : (
              <YStack padding="$4" alignItems="center">
                <Text color="$mutedForeground">No details available</Text>
              </YStack>
            )}
          </ScrollView>
        </YStack>
      </ResponsiveDialog>
    </SafeAreaView>
  );
}
