import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { 
  Home, 
  Users, 
  Store,
  ShoppingCart,
} from '@tamagui/lucide-icons';
import { useCart } from '@/contexts/CartContext';
import { View, Text } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { itemCount } = useCart();

  // Theme colors
  const activeColor = '#7c3aed'; // Primary purple
  const inactiveColor = colorScheme === 'dark' ? '#94a3b8' : '#64748b';
  const backgroundColor = colorScheme === 'dark' ? '#0f172a' : '#ffffff';
  const borderColor = colorScheme === 'dark' ? '#1e293b' : '#e2e8f0';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarStyle: {
          backgroundColor,
          borderTopColor: borderColor,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      {/* Main tabs for all users */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop/index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Store size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
        }}
      />

      {/* Hidden screens - accessible via navigation but not in tab bar */}
      {/* Manager screens */}
      <Tabs.Screen name="manager/index" options={{ href: null }} />
      <Tabs.Screen name="manager/approvals" options={{ href: null }} />
      <Tabs.Screen name="manager/users" options={{ href: null }} />
      <Tabs.Screen name="manager/analytics" options={{ href: null }} />
      <Tabs.Screen name="manager/settings" options={{ href: null }} />
      <Tabs.Screen name="manager/deliveries" options={{ href: null }} />
      <Tabs.Screen name="manager/trainers" options={{ href: null }} />
      <Tabs.Screen name="manager/bundles" options={{ href: null }} />
      
      {/* Trainer screens */}
      <Tabs.Screen name="trainer/index" options={{ href: null }} />
      <Tabs.Screen name="trainer/bundles" options={{ href: null }} />
      <Tabs.Screen name="trainer/clients" options={{ href: null }} />
      <Tabs.Screen name="trainer/schedule" options={{ href: null }} />
      <Tabs.Screen name="trainer/earnings" options={{ href: null }} />
      <Tabs.Screen name="trainer/deliveries" options={{ href: null }} />
      <Tabs.Screen name="trainer/points" options={{ href: null }} />
      <Tabs.Screen name="trainer/status" options={{ href: null }} />
      
      {/* Client screens */}
      <Tabs.Screen name="client/index" options={{ href: null }} />
      <Tabs.Screen name="client/orders" options={{ href: null }} />
      <Tabs.Screen name="client/deliveries" options={{ href: null }} />
      <Tabs.Screen name="client/spending" options={{ href: null }} />
    </Tabs>
  );
}
