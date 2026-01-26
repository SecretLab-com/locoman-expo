import { ReactNode } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, Settings, MoreVertical } from '@tamagui/lucide-icons';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { UserAvatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';

// Header component
interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showSettings?: boolean;
  showProfile?: boolean;
  rightElement?: ReactNode;
  onBack?: () => void;
  notificationCount?: number;
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  showNotifications = false,
  showSettings = false,
  showProfile = false,
  rightElement,
  onBack,
  notificationCount = 0,
  transparent = false,
}: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      alignItems="center"
      justifyContent="space-between"
      backgroundColor={transparent ? 'transparent' : '$background'}
      borderBottomWidth={transparent ? 0 : 1}
      borderBottomColor="$borderColor"
    >
      {/* Left side */}
      <XStack alignItems="center" gap="$2" flex={1}>
        {showBack && (
          <Button variant="ghost" size="icon" onPress={handleBack}>
            <ChevronLeft size={24} color="$color" />
          </Button>
        )}
        {(title || subtitle) && (
          <YStack flex={1}>
            {title && (
              <Text fontSize="$5" fontWeight="600" color="$color" numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text fontSize="$2" color="$mutedForeground" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </YStack>
        )}
      </XStack>

      {/* Right side */}
      <XStack alignItems="center" gap="$2">
        {rightElement}
        
        {showNotifications && (
          <YStack position="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onPress={() => router.push('/notifications')}
            >
              <Bell size={22} color="$color" />
            </Button>
            {notificationCount > 0 && (
              <Badge
                variant="error"
                size="sm"
                position="absolute"
                top={-4}
                right={-4}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </Badge>
            )}
          </YStack>
        )}

        {showSettings && (
          <Button 
            variant="ghost" 
            size="icon" 
            onPress={() => router.push('/settings')}
          >
            <Settings size={22} color="$color" />
          </Button>
        )}

        {showProfile && user && (
          <Button 
            variant="ghost" 
            size="icon" 
            onPress={() => router.push('/profile')}
            padding="$1"
          >
            <UserAvatar src={user.avatar} name={user.name} size="sm" />
          </Button>
        )}
      </XStack>
    </XStack>
  );
}

// Page header for dashboard pages
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <YStack gap="$3" paddingBottom="$2">
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack flex={1} gap="$1">
          <Text fontSize="$7" fontWeight="700" color="$color">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="$3" color="$mutedForeground">
              {subtitle}
            </Text>
          )}
        </YStack>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}

// Main AppShell component
interface AppShellProps {
  children: ReactNode;
  // Header props
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBack?: boolean;
  showNotifications?: boolean;
  showSettings?: boolean;
  showProfile?: boolean;
  headerRightElement?: ReactNode;
  transparentHeader?: boolean;
  notificationCount?: number;
  onBack?: () => void;
  // Content props
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padding?: boolean;
  safeAreaEdges?: ('top' | 'bottom' | 'left' | 'right')[];
  backgroundColor?: string;
}

export function AppShell({
  children,
  title,
  subtitle,
  showHeader = true,
  showBack = false,
  showNotifications = false,
  showSettings = false,
  showProfile = false,
  headerRightElement,
  transparentHeader = false,
  notificationCount = 0,
  onBack,
  scrollable = true,
  refreshing = false,
  onRefresh,
  padding = true,
  safeAreaEdges = ['top'],
  backgroundColor = '$background',
}: AppShellProps) {
  const content = (
    <YStack flex={1} backgroundColor={backgroundColor}>
      {showHeader && (
        <Header
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          showNotifications={showNotifications}
          showSettings={showSettings}
          showProfile={showProfile}
          rightElement={headerRightElement}
          notificationCount={notificationCount}
          transparent={transparentHeader}
          onBack={onBack}
        />
      )}
      
      {scrollable ? (
        <ScrollView
          flex={1}
          contentContainerStyle={{
            padding: padding ? 16 : 0,
            paddingBottom: padding ? 32 : 0,
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <YStack flex={1} padding={padding ? '$4' : 0}>
          {children}
        </YStack>
      )}
    </YStack>
  );

  return (
    <SafeAreaView 
      style={{ flex: 1, backgroundColor }} 
      edges={safeAreaEdges}
    >
      {content}
    </SafeAreaView>
  );
}

// Section component for grouping content
interface SectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  gap?: number | string;
}

export function Section({ title, description, action, children, gap = '$3' }: SectionProps) {
  return (
    <YStack gap={gap as any}>
      {(title || description || action) && (
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            {title && (
              <Text fontSize="$4" fontWeight="600" color="$color">
                {title}
              </Text>
            )}
            {description && (
              <Text fontSize="$2" color="$mutedForeground">
                {description}
              </Text>
            )}
          </YStack>
          {action}
        </XStack>
      )}
      {children}
    </YStack>
  );
}

// Grid layout for cards
interface GridProps {
  children: ReactNode;
  columns?: number;
  gap?: number | string;
}

export function Grid({ children, columns = 2, gap = '$3' }: GridProps) {
  return (
    <XStack flexWrap="wrap" gap={gap as any} marginHorizontal={`-${gap}`}>
      {children}
    </XStack>
  );
}

export default AppShell;
