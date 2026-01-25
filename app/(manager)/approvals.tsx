import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

type ApprovalType = "bundle" | "ad" | "trainer";
type ApprovalStatus = "pending" | "approved" | "rejected";

type Approval = {
  id: number;
  type: ApprovalType;
  title: string;
  description: string;
  submittedBy: string;
  submittedAt: string;
  status: ApprovalStatus;
  details: Record<string, any>;
};

const TYPE_TABS: { key: ApprovalType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bundle", label: "Bundles" },
  { key: "ad", label: "Ads" },
  { key: "trainer", label: "Trainers" },
];

// Mock data
const MOCK_APPROVALS: Approval[] = [
  {
    id: 1,
    type: "bundle",
    title: "Premium Fitness Bundle",
    description: "12-week transformation program with supplements and coaching",
    submittedBy: "Sarah Johnson",
    submittedAt: "2026-01-24",
    status: "pending",
    details: {
      price: 299.99,
      products: 3,
      services: 2,
    },
  },
  {
    id: 2,
    type: "ad",
    title: "FitGear Pro Partnership",
    description: "Equipment brand partnership request",
    submittedBy: "Mike Chen",
    submittedAt: "2026-01-23",
    status: "pending",
    details: {
      businessName: "FitGear Pro",
      commissionRate: 15,
    },
  },
  {
    id: 3,
    type: "trainer",
    title: "New Trainer Application",
    description: "Certified personal trainer with 5 years experience",
    submittedBy: "Alex Rivera",
    submittedAt: "2026-01-22",
    status: "pending",
    details: {
      certifications: ["NASM", "ACE"],
      specialties: ["Weight Loss", "Strength Training"],
    },
  },
  {
    id: 4,
    type: "bundle",
    title: "Beginner Starter Pack",
    description: "Entry-level bundle for new clients",
    submittedBy: "Emily Davis",
    submittedAt: "2026-01-21",
    status: "approved",
    details: {
      price: 99.99,
      products: 2,
      services: 1,
    },
  },
];

export default function ManagerApprovalsScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<ApprovalType | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>(MOCK_APPROVALS);

  const filteredApprovals = approvals.filter(
    (a) => activeTab === "all" || a.type === activeTab
  );

  const pendingApprovals = filteredApprovals.filter((a) => a.status === "pending");
  const processedApprovals = filteredApprovals.filter((a) => a.status !== "pending");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleApprove = (approval: Approval) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert("Approve", `Approve "${approval.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () => {
          setApprovals((prev) =>
            prev.map((a) => (a.id === approval.id ? { ...a, status: "approved" as ApprovalStatus } : a))
          );
        },
      },
    ]);
  };

  const handleReject = (approval: Approval) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Alert.alert("Reject", `Reject "${approval.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          setApprovals((prev) =>
            prev.map((a) => (a.id === approval.id ? { ...a, status: "rejected" as ApprovalStatus } : a))
          );
        },
      },
    ]);
  };

  const getTypeIcon = (type: ApprovalType): any => {
    switch (type) {
      case "bundle":
        return "shippingbox.fill";
      case "ad":
        return "megaphone.fill";
      case "trainer":
        return "person.fill";
      default:
        return "doc.fill";
    }
  };

  const getTypeColor = (type: ApprovalType) => {
    switch (type) {
      case "bundle":
        return colors.primary;
      case "ad":
        return colors.warning;
      case "trainer":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const renderApproval = ({ item }: { item: Approval }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-start mb-3">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${getTypeColor(item.type)}20` }}
        >
          <IconSymbol name={getTypeIcon(item.type)} size={20} color={getTypeColor(item.type)} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{item.title}</Text>
          <Text className="text-muted text-sm">{item.description}</Text>
        </View>
        {item.status !== "pending" && (
          <View
            className="px-2 py-1 rounded-full"
            style={{
              backgroundColor:
                item.status === "approved" ? `${colors.success}20` : `${colors.error}20`,
            }}
          >
            <Text
              className="text-xs font-medium capitalize"
              style={{ color: item.status === "approved" ? colors.success : colors.error }}
            >
              {item.status}
            </Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <View className="flex-row items-center mb-1">
          <IconSymbol name="person.fill" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">Submitted by: {item.submittedBy}</Text>
        </View>
        <View className="flex-row items-center">
          <IconSymbol name="calendar" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">{item.submittedAt}</Text>
        </View>

        {/* Type-specific details */}
        {item.type === "bundle" && (
          <View className="flex-row mt-2 gap-3">
            <Text className="text-foreground text-sm">
              Price: <Text className="font-semibold">${item.details.price}</Text>
            </Text>
            <Text className="text-foreground text-sm">
              Products: <Text className="font-semibold">{item.details.products}</Text>
            </Text>
            <Text className="text-foreground text-sm">
              Services: <Text className="font-semibold">{item.details.services}</Text>
            </Text>
          </View>
        )}

        {item.type === "ad" && (
          <View className="mt-2">
            <Text className="text-foreground text-sm">
              Business: <Text className="font-semibold">{item.details.businessName}</Text>
            </Text>
            <Text className="text-foreground text-sm">
              Commission: <Text className="font-semibold">{item.details.commissionRate}%</Text>
            </Text>
          </View>
        )}

        {item.type === "trainer" && (
          <View className="mt-2">
            <Text className="text-foreground text-sm">
              Certifications:{" "}
              <Text className="font-semibold">{item.details.certifications?.join(", ")}</Text>
            </Text>
            <Text className="text-foreground text-sm">
              Specialties:{" "}
              <Text className="font-semibold">{item.details.specialties?.join(", ")}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {item.status === "pending" && (
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 bg-success py-3 rounded-lg items-center"
            onPress={() => handleApprove(item)}
          >
            <Text className="text-background font-semibold">Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-error py-3 rounded-lg items-center"
            onPress={() => handleReject(item)}
          >
            <Text className="text-background font-semibold">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Stats
  const stats = {
    pending: approvals.filter((a) => a.status === "pending").length,
    approved: approvals.filter((a) => a.status === "approved").length,
    rejected: approvals.filter((a) => a.status === "rejected").length,
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="py-4">
        <Text className="text-2xl font-bold text-foreground">Approvals</Text>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-warning/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-warning">{stats.pending}</Text>
          <Text className="text-xs text-muted">Pending</Text>
        </View>
        <View className="flex-1 bg-success/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-success">{stats.approved}</Text>
          <Text className="text-xs text-muted">Approved</Text>
        </View>
        <View className="flex-1 bg-error/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-error">{stats.rejected}</Text>
          <Text className="text-xs text-muted">Rejected</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row mb-4">
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-2 items-center border-b-2 ${
              activeTab === tab.key ? "border-primary" : "border-transparent"
            }`}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key ? "text-primary" : "text-muted"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Approvals List */}
      <FlatList
        data={[...pendingApprovals, ...processedApprovals]}
        renderItem={renderApproval}
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
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4">No approvals pending</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
