import { useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type PartnershipStatus = "pending" | "active" | "rejected" | "expired";

type Partnership = {
  id: string;
  businessName: string;
  businessType: string;
  description: string;
  status: PartnershipStatus;
  commissionRate: number;
  totalEarnings: number;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
  expiresAt?: string | null;
};

type Business = {
  id: string;
  name: string;
  type: string;
  description: string;
  commissionRate: number;
  isAvailable: boolean;
};

function toPartnershipStatus(value: unknown): PartnershipStatus {
  if (value === "active" || value === "rejected" || value === "expired") {
    return value;
  }
  return "pending";
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export default function TrainerPartnershipsScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const partnershipsQuery = trpc.partnerships.list.useQuery();
  const availableBusinessesQuery = trpc.partnerships.availableBusinesses.useQuery();

  const requestPartnershipMutation = trpc.partnerships.request.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.partnerships.list.invalidate(),
        utils.partnerships.availableBusinesses.invalidate(),
      ]);
    },
  });

  const submitBusinessMutation = trpc.partnerships.submitBusiness.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.partnerships.list.invalidate(),
        utils.partnerships.availableBusinesses.invalidate(),
      ]);
    },
  });

  // Submit business form state
  const [businessForm, setBusinessForm] = useState({
    name: "",
    type: "",
    description: "",
    website: "",
    contactEmail: "",
  });

  const partnerships = useMemo<Partnership[]>(() => {
    const rows = (partnershipsQuery.data ?? []) as any[];
    return rows.map((row) => ({
      id: String(row.id),
      businessName: String(row.businessName || "Business"),
      businessType: String(row.businessType || "General"),
      description: String(row.description || ""),
      status: toPartnershipStatus(row.status),
      commissionRate: toNumber(row.commissionRate, 0),
      totalEarnings: toNumber(row.totalEarnings, 0),
      clickCount: Math.max(0, Math.round(toNumber(row.clickCount, 0))),
      conversionCount: Math.max(0, Math.round(toNumber(row.conversionCount, 0))),
      createdAt: String(row.createdAt || ""),
      expiresAt: row.expiresAt ? String(row.expiresAt) : null,
    }));
  }, [partnershipsQuery.data]);

  const availableBusinesses = useMemo<Business[]>(() => {
    const rows = (availableBusinessesQuery.data ?? []) as any[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name || "Business"),
      type: String(row.type || "General"),
      description: String(row.description || ""),
      commissionRate: toNumber(row.commissionRate, 0),
      isAvailable: row.isAvailable !== false,
    }));
  }, [availableBusinessesQuery.data]);

  const refreshing = partnershipsQuery.isRefetching || availableBusinessesQuery.isRefetching;

  const onRefresh = useCallback(async () => {
    await Promise.all([
      partnershipsQuery.refetch(),
      availableBusinessesQuery.refetch(),
    ]);
  }, [availableBusinessesQuery, partnershipsQuery]);

  const handleCreatePartnership = (business: Business) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Create Partnership",
      `Request partnership with ${business.name}? Commission rate: ${business.commissionRate}%`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            try {
              await requestPartnershipMutation.mutateAsync({ businessId: business.id });
              setShowAddModal(false);
              Alert.alert("Success", "Partnership request submitted!");
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to submit partnership request.";
              Alert.alert("Error", message);
            }
          },
        },
      ]
    );
  };

  const handleSubmitBusiness = async () => {
    if (!businessForm.name.trim() || !businessForm.type.trim() || !businessForm.contactEmail.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      await submitBusinessMutation.mutateAsync({
        name: businessForm.name.trim(),
        type: businessForm.type.trim(),
        description: businessForm.description.trim() || undefined,
        website: businessForm.website.trim() || undefined,
        contactEmail: businessForm.contactEmail.trim(),
      });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Business Submitted",
        "Your business submission has been received. We'll review it and get back to you within 2-3 business days.",
        [{ text: "OK", onPress: () => setShowSubmitModal(false) }]
      );

      setBusinessForm({
        name: "",
        type: "",
        description: "",
        website: "",
        contactEmail: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit business.";
      Alert.alert("Error", message);
    }
  };

  const getStatusColor = (status: PartnershipStatus) => {
    switch (status) {
      case "active":
        return colors.success;
      case "pending":
        return colors.warning;
      case "rejected":
        return colors.error;
      case "expired":
        return colors.muted;
      default:
        return colors.muted;
    }
  };

  // Calculate totals
  const totalEarnings = partnerships
    .filter((partnership) => partnership.status === "active")
    .reduce((sum, partnership) => sum + partnership.totalEarnings, 0);
  const activeCount = partnerships.filter((partnership) => partnership.status === "active").length;
  const pendingCount = partnerships.filter((partnership) => partnership.status === "pending").length;

  const renderPartnership = ({ item }: { item: Partnership }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.businessName}</Text>
          <Text className="text-sm text-muted">{item.businessType}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <Text className="text-muted text-sm mb-3" numberOfLines={2}>
        {item.description}
      </Text>

      {item.status === "active" && (
        <View className="bg-background rounded-lg p-3">
          <View className="flex-row justify-between mb-2">
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-primary">
                ${item.totalEarnings.toFixed(2)}
              </Text>
              <Text className="text-xs text-muted">Earnings</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-foreground">{item.clickCount}</Text>
              <Text className="text-xs text-muted">Clicks</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-foreground">{item.conversionCount}</Text>
              <Text className="text-xs text-muted">Conversions</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-success">{item.commissionRate}%</Text>
              <Text className="text-xs text-muted">Commission</Text>
            </View>
          </View>
        </View>
      )}

      {item.status === "pending" && (
        <View className="bg-warning/10 rounded-lg p-3">
          <Text className="text-warning text-sm text-center">
            Awaiting approval from {item.businessName}
          </Text>
        </View>
      )}
    </View>
  );

  if (partnershipsQuery.isLoading && partnerships.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading partnerships...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center justify-between py-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Ad Partnerships</Text>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg"
          onPress={() => setShowAddModal(true)}
        >
          <Text className="text-background font-medium">+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-primary/10 rounded-xl p-4 items-center">
          <Text className="text-2xl font-bold text-primary">${totalEarnings.toFixed(2)}</Text>
          <Text className="text-xs text-muted">Total Earnings</Text>
        </View>
        <View className="flex-1 bg-success/10 rounded-xl p-4 items-center">
          <Text className="text-2xl font-bold text-success">{activeCount}</Text>
          <Text className="text-xs text-muted">Active</Text>
        </View>
        <View className="flex-1 bg-warning/10 rounded-xl p-4 items-center">
          <Text className="text-2xl font-bold text-warning">{pendingCount}</Text>
          <Text className="text-xs text-muted">Pending</Text>
        </View>
      </View>

      {partnershipsQuery.isError && (
        <View className="bg-error/10 border border-error rounded-xl p-3 mb-3">
          <Text className="text-error text-sm">
            {partnershipsQuery.error.message || "Failed to load partnerships."}
          </Text>
        </View>
      )}

      {/* Partnerships List */}
      <FlatList
        data={partnerships}
        renderItem={renderPartnership}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="megaphone.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4">No partnerships yet</Text>
            <TouchableOpacity
              className="mt-4 bg-primary px-6 py-3 rounded-lg"
              onPress={() => setShowAddModal(true)}
            >
              <Text className="text-background font-semibold">Create Partnership</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Partnership Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text className="text-primary font-medium">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">Add Partnership</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Submit Your Business */}
            <TouchableOpacity
              className="bg-surface border border-border rounded-xl p-4 mb-6"
              onPress={() => {
                setShowAddModal(false);
                setShowSubmitModal(true);
              }}
            >
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-3">
                  <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Submit Your Business</Text>
                  <Text className="text-muted text-sm">
                    Have a business? Submit it for partnership
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </View>
            </TouchableOpacity>

            {/* Available Businesses */}
            <Text className="text-lg font-semibold text-foreground mb-3">
              Available Businesses
            </Text>

            {availableBusinessesQuery.isLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : availableBusinesses.length === 0 ? (
              <View className="bg-surface border border-border rounded-xl p-4">
                <Text className="text-muted text-center">No available businesses right now</Text>
              </View>
            ) : (
              availableBusinesses.map((business) => (
                <ActionButton
                  key={business.id}
                  className="bg-surface border border-border rounded-xl p-4 mb-3"
                  onPress={() => handleCreatePartnership(business)}
                  loading={requestPartnershipMutation.isPending}
                  loadingText="Requesting..."
                  disabled={!business.isAvailable}
                  accessibilityLabel={`Request partnership with ${business.name}`}
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{business.name}</Text>
                      <Text className="text-muted text-sm">{business.type}</Text>
                    </View>
                    <View className="bg-success/10 px-3 py-1 rounded-full">
                      <Text className="text-success text-sm font-medium">
                        {business.commissionRate}%
                      </Text>
                    </View>
                  </View>
                  <Text className="text-muted text-sm">{business.description}</Text>
                </ActionButton>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Submit Business Modal */}
      <Modal visible={showSubmitModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <TouchableOpacity onPress={() => setShowSubmitModal(false)}>
              <Text className="text-primary font-medium">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">Submit Business</Text>
            <ActionButton
              onPress={handleSubmitBusiness}
              loading={submitBusinessMutation.isPending}
              loadingText="Submitting..."
              variant="ghost"
              className="px-0 py-0 min-h-0"
              accessibilityLabel="Submit business"
            >
              <Text className="text-primary font-medium">Submit</Text>
            </ActionButton>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Business Name *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter business name"
                placeholderTextColor={colors.muted}
                value={businessForm.name}
                onChangeText={(text) => setBusinessForm((prev) => ({ ...prev, name: text }))}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Business Type *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="e.g., Gym, Supplements, Apparel"
                placeholderTextColor={colors.muted}
                value={businessForm.type}
                onChangeText={(text) => setBusinessForm((prev) => ({ ...prev, type: text }))}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Description</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Brief description of the business"
                placeholderTextColor={colors.muted}
                value={businessForm.description}
                onChangeText={(text) =>
                  setBusinessForm((prev) => ({ ...prev, description: text }))
                }
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Website</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="https://example.com"
                placeholderTextColor={colors.muted}
                value={businessForm.website}
                onChangeText={(text) => setBusinessForm((prev) => ({ ...prev, website: text }))}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Contact Email *</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="business@example.com"
                placeholderTextColor={colors.muted}
                value={businessForm.contactEmail}
                onChangeText={(text) =>
                  setBusinessForm((prev) => ({ ...prev, contactEmail: text }))
                }
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
