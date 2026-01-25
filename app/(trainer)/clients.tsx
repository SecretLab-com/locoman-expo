import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock data for trainer's clients
const MOCK_CLIENTS = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@email.com",
    avatar: "https://i.pravatar.cc/150?img=11",
    activeBundles: 2,
    totalSpent: 299.98,
    lastActive: "2024-03-20",
    status: "active",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@email.com",
    avatar: "https://i.pravatar.cc/150?img=12",
    activeBundles: 1,
    totalSpent: 149.99,
    lastActive: "2024-03-19",
    status: "active",
  },
  {
    id: 3,
    name: "Mike Johnson",
    email: "mike.j@email.com",
    avatar: "https://i.pravatar.cc/150?img=13",
    activeBundles: 3,
    totalSpent: 389.97,
    lastActive: "2024-03-18",
    status: "active",
  },
  {
    id: 4,
    name: "Sarah Williams",
    email: "sarah.w@email.com",
    avatar: "https://i.pravatar.cc/150?img=14",
    activeBundles: 0,
    totalSpent: 79.99,
    lastActive: "2024-02-15",
    status: "inactive",
  },
  {
    id: 5,
    name: "David Brown",
    email: "david.b@email.com",
    avatar: "https://i.pravatar.cc/150?img=15",
    activeBundles: 1,
    totalSpent: 129.99,
    lastActive: "2024-03-17",
    status: "active",
  },
];

type Client = (typeof MOCK_CLIENTS)[0];

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center">
        <Image
          source={{ uri: client.avatar }}
          className="w-14 h-14 rounded-full"
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-foreground">{client.name}</Text>
            <View
              className={`w-2 h-2 rounded-full ml-2 ${
                client.status === "active" ? "bg-success" : "bg-muted"
              }`}
            />
          </View>
          <Text className="text-sm text-muted mt-0.5">{client.email}</Text>
          <View className="flex-row items-center mt-2">
            <View className="flex-row items-center mr-4">
              <IconSymbol name="bag.fill" size={14} color={colors.primary} />
              <Text className="text-sm text-muted ml-1">{client.activeBundles} bundles</Text>
            </View>
            <View className="flex-row items-center">
              <IconSymbol name="dollarsign.circle.fill" size={14} color={colors.success} />
              <Text className="text-sm text-muted ml-1">${client.totalSpent.toFixed(2)}</Text>
            </View>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );
}

export default function TrainerClientsScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filteredClients = MOCK_CLIENTS.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeClients = filteredClients.filter((c) => c.status === "active");
  const inactiveClients = filteredClients.filter((c) => c.status === "inactive");

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleClientPress = (client: Client) => {
    // Navigate to client detail - coming soon
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Clients</Text>
        <Text className="text-sm text-muted">{MOCK_CLIENTS.length} total clients</Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3 mt-4">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search clients..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={[
          { type: "header", title: `Active (${activeClients.length})` },
          ...activeClients.map((c) => ({ type: "client", data: c })),
          { type: "header", title: `Inactive (${inactiveClients.length})` },
          ...inactiveClients.map((c) => ({ type: "client", data: c })),
        ]}
        keyExtractor={(item, index) => {
          if (item.type === "header") return `header-${index}`;
          return `client-${(item as any).data.id}`;
        }}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <Text className="text-sm font-semibold text-muted uppercase px-4 py-2 mt-2">
                {(item as any).title}
              </Text>
            );
          }
          return (
            <View className="px-4">
              <ClientCard
                client={(item as any).data}
                onPress={() => handleClientPress((item as any).data)}
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No clients found</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </ScreenContainer>
  );
}
