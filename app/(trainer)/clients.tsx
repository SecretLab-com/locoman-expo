import { BulkInviteModal } from "@/components/bulk-invite-modal";
import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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

function ClientAvatar({ uri }: { uri?: string | null }) {
  const colors = useColors();
  const [hasError, setHasError] = useState(false);
  const isValidUri = typeof uri === "string" && uri.trim().length > 0;

  return (
    <View className="w-14 h-14 rounded-full bg-muted/30 overflow-hidden items-center justify-center">
      {isValidUri && !hasError ? (
        <Image
          source={{ uri }}
          className="w-14 h-14 rounded-full"
          contentFit="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <IconSymbol name="person.fill" size={22} color={colors.muted} />
      )}
    </View>
  );
}

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Open ${client.name} details`}
      testID={`trainer-client-${client.id}`}
    >
      <View className="flex-row items-center">
        <ClientAvatar uri={client.avatar} />
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-foreground">{client.name}</Text>
            <View
              className={`w-2 h-2 rounded-full ml-2 ${client.status === "active" ? "bg-success" : "bg-muted"
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
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkInvite, setShowBulkInvite] = useState(false);

  // Fetch real clients from tRPC
  const { data: clientsData, isLoading, refetch } = trpc.clients.list.useQuery();
  const bulkInviteMutation = trpc.clients.bulkInvite.useMutation();

  const clients = clientsData || [];

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeClients = filteredClients.filter((c) => c.status === "active");
  const inactiveClients = filteredClients.filter((c) => c.status !== "active");

  const onRefresh = async () => {
    await refetch();
  };

  const handleClientPress = (client: any) => {
    router.push(`/client-detail/${client.id}` as any);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Clients"
        subtitle={`${clients.length} total clients`}
        rightAction={{
          icon: "person.badge.plus",
          onPress: () => setShowBulkInvite(true),
          label: "Bulk invite",
          testID: "bulk-invite",
        }}
      />

      {/* Content */}
      <View className="px-4 pb-4">

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
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No clients found</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Bulk Invite Modal */}
      <BulkInviteModal
        visible={showBulkInvite}
        onClose={() => setShowBulkInvite(false)}
        onSubmit={async (invites) => {
          if (!user?.id) return;
          await bulkInviteMutation.mutateAsync({
            invitations: invites.map((invite) => ({
              email: invite.email,
              name: invite.name,
            })),
          });
        }}
      />
    </ScreenContainer>
  );
}
