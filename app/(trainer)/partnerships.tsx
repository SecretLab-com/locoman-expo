import { useState, useCallback } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

type PartnershipStatus = "pending" | "active" | "rejected" | "expired";

type Partnership = {
  id: number;
  businessName: string;
  businessType: string;
  description: string;
  status: PartnershipStatus;
  commissionRate: number;
  totalEarnings: number;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
  expiresAt?: string;
};

type Business = {
  id: number;
  name: string;
  type: string;
  description: string;
  commissionRate: number;
  isAvailable: boolean;
};

// Mock data
const MOCK_PARTNERSHIPS: Partnership[] = [
  {
    id: 1,
    businessName: "FitGear Pro",
    businessType: "Equipment",
    description: "Premium fitness equipment and accessories",
    status: "active",
    commissionRate: 15,
    totalEarnings: 450.0,
    clickCount: 234,
    conversionCount: 12,
    createdAt: "2025-12-01",
    expiresAt: "2026-12-01",
  },
  {
    id: 2,
    businessName: "NutriMax",
    businessType: "Supplements",
    description: "High-quality supplements and nutrition products",
    status: "pending",
    commissionRate: 10,
    totalEarnings: 0,
    clickCount: 0,
    conversionCount: 0,
    createdAt: "2026-01-20",
  },
];

const MOCK_AVAILABLE_BUSINESSES: Business[] = [
  {
    id: 1,
    name: "PowerLift Gym",
    type: "Gym",
    description: "Local gym chain with premium facilities",
    commissionRate: 20,
    isAvailable: true,
  },
  {
    id: 2,
    name: "HealthyMeals Co",
    type: "Meal Prep",
    description: "Healthy meal prep delivery service",
    commissionRate: 12,
    isAvailable: true,
  },
  {
    id: 3,
    name: "SportWear Plus",
    type: "Apparel",
    description: "Athletic wear and sportswear brand",
    commissionRate: 8,
    isAvailable: true,
  },
];

export default function TrainerPartnershipsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [partnerships, setPartnerships] = useState<Partnership[]>(MOCK_PARTNERSHIPS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Submit business form state
  const [businessForm, setBusinessForm] = useState({
    name: "",
    type: "",
    description: "",
    website: "",
    contactEmail: "",
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
          onPress: () => {
            const newPartnership: Partnership = {
              id: Date.now(),
              businessName: business.name,
              businessType: business.type,
              description: business.description,
              status: "pending",
              commissionRate: business.commissionRate,
              totalEarnings: 0,
              clickCount: 0,
              conversionCount: 0,
              createdAt: new Date().toISOString().split("T")[0],
            };
            setPartnerships((prev) => [...prev, newPartnership]);
            setShowAddModal(false);
            Alert.alert("Success", "Partnership request submitted!");
          },
        },
      ]
    );
  };

  const handleSubmitBusiness = () => {
    if (!businessForm.name || !businessForm.type || !businessForm.contactEmail) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

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
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + p.totalEarnings, 0);
  const activeCount = partnerships.filter((p) => p.status === "active").length;
  const pendingCount = partnerships.filter((p) => p.status === "pending").length;

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

      {/* Partnerships List */}
      <FlatList
        data={partnerships}
        renderItem={renderPartnership}
        keyExtractor={(item) => item.id.toString()}
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
            {MOCK_AVAILABLE_BUSINESSES.map((business) => (
              <TouchableOpacity
                key={business.id}
                className="bg-surface border border-border rounded-xl p-4 mb-3"
                onPress={() => handleCreatePartnership(business)}
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
              </TouchableOpacity>
            ))}
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
            <TouchableOpacity onPress={handleSubmitBusiness}>
              <Text className="text-primary font-medium">Submit</Text>
            </TouchableOpacity>
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
