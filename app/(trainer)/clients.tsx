import { BulkInviteModal } from "@/components/bulk-invite-modal";
import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === "web" && navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const Clipboard = require("expo-clipboard");
    await Clipboard.setStringAsync(text);
  } catch {
    if (Platform.OS === "web") {
      window.prompt("Copy this link:", text);
    }
  }
};

type Client = {
  id: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  photoUrl?: string | null;
  activeBundles: number;
  totalSpent: number;
  lastActive?: string | null;
  status: string;
};

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

function ClientCard({ client, onPress, onRequestPayment }: { client: Client; onPress: () => void; onRequestPayment: () => void }) {
  const colors = useColors();

  return (
    <View className="bg-surface rounded-xl mb-3 border border-border overflow-hidden">
      <TouchableOpacity
        className="p-4"
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Open ${client.name} details`}
        testID={`trainer-client-${client.id}`}
      >
        <View className="flex-row items-center">
          <ClientAvatar uri={client.avatar || client.photoUrl} />
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
                <Text className="text-sm text-muted ml-1">${Number(client.totalSpent || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        className="flex-row items-center justify-center py-2.5 border-t border-border"
        onPress={onRequestPayment}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Request payment from ${client.name}`}
        testID={`trainer-client-pay-${client.id}`}
      >
        <IconSymbol name="creditcard.fill" size={14} color={colors.primary} />
        <Text className="text-primary font-medium text-sm ml-1.5">Request Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TrainerClientsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payClientName, setPayClientName] = useState("");
  const [payClientId, setPayClientId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");
  const [payLinkResult, setPayLinkResult] = useState<string | null>(null);

  // Fetch real clients from tRPC
  const { data: clientsData, isLoading, refetch, isRefetching } = trpc.clients.list.useQuery();
  const bulkInviteMutation = trpc.clients.bulkInvite.useMutation();

  const createPayLink = trpc.payments.createLink.useMutation({
    onSuccess: (data) => {
      setPayAmount("");
      setPayDescription("");
      setPayLinkResult(data.linkUrl);
    },
    onError: (err) => {
      showAlert("Payment Error", err.message);
    },
  });

  const handleOpenPayModal = (client: any) => {
    setPayClientName(client.name);
    setPayClientId(client.id);
    setPayAmount("");
    setPayDescription("");
    setPayLinkResult(null);
    setPayModalOpen(true);
  };

  const handleSubmitPayment = async () => {
    await haptics.light();
    const amountFloat = parseFloat(payAmount);
    if (!amountFloat || amountFloat <= 0) {
      showAlert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    createPayLink.mutate({
      amountMinor: Math.round(amountFloat * 100),
      description: payDescription || `Payment from ${payClientName}`,
      payerId: payClientId || undefined,
    });
  };

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

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
                onRequestPayment={() => handleOpenPayModal((item as any).data)}
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No clients found</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      )}

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

      {/* Request Payment Modal */}
      <Modal
        visible={payModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setPayModalOpen(false); setPayLinkResult(null); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setPayModalOpen(false); setPayLinkResult(null); }} />
          <View className="bg-background rounded-t-3xl p-6" onStartShouldSetResponder={() => true}>
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xl font-bold text-foreground">
                  {payLinkResult ? "Payment Link Ready" : "Request Payment"}
                </Text>
                <Text className="text-sm text-muted">for {payClientName}</Text>
              </View>
              <TouchableOpacity onPress={() => { setPayModalOpen(false); setPayLinkResult(null); }}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {payLinkResult ? (
              <View>
                <View className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center mb-2">
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <Text className="text-success font-semibold ml-2">Payment link created</Text>
                  </View>
                  <Text className="text-foreground text-sm" selectable>{payLinkResult}</Text>
                </View>
                <View className="flex-row gap-3 mb-4">
                  <TouchableOpacity
                    className="flex-1 bg-primary py-4 rounded-xl items-center"
                    onPress={async () => { await copyToClipboard(payLinkResult); await haptics.light(); showAlert("Copied", "Payment link copied"); }}
                  >
                    <Text className="text-white font-bold">Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border py-4 rounded-xl items-center"
                    onPress={async () => {
                      try {
                        const { Share } = require("react-native");
                        await Share.share({ message: `Hi ${payClientName}, please complete your payment: ${payLinkResult}`, url: payLinkResult });
                      } catch { await copyToClipboard(payLinkResult); }
                    }}
                  >
                    <Text className="text-foreground font-bold">Share</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity className="py-3 items-center" onPress={() => setPayLinkResult(null)}>
                  <Text className="text-primary font-medium">Create Another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Amount (£)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-bold mb-4"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                />
                <Text className="text-sm font-medium text-muted mb-2">Description (optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-6"
                  placeholder={`e.g. PT session with ${payClientName}`}
                  placeholderTextColor={colors.muted}
                  value={payDescription}
                  onChangeText={setPayDescription}
                />
                <TouchableOpacity
                  className="bg-primary py-4 rounded-xl items-center"
                  onPress={handleSubmitPayment}
                  disabled={createPayLink.isPending}
                  activeOpacity={0.8}
                >
                  {createPayLink.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-lg">Generate Payment Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
