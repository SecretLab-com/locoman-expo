import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

type BundleStatus = "draft" | "pending_review" | "changes_requested" | "published" | "rejected";

type Bundle = {
  id: number;
  trainerId: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  cadence: string | null;
  status: BundleStatus;
  productsJson: any;
  servicesJson: any;
  goalsJson: any;
  submittedForReviewAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: number | null;
  reviewComments: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  trainer?: {
    id: number;
    name: string | null;
    photoUrl: string | null;
  };
};

const STATUS_TABS: { key: BundleStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending_review", label: "Pending" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

export default function ManagerApprovalsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BundleStatus | "all">("pending_review");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [comments, setComments] = useState("");
  const utils = trpc.useUtils();

  // Use real API
  const { data: bundles = [], isLoading, refetch, isRefetching } = trpc.admin.pendingBundles.useQuery();
  
  const approveMutation = trpc.admin.approveBundle.useMutation({
    onSuccess: () => {
      utils.admin.pendingBundles.invalidate();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });
  
  const rejectMutation = trpc.admin.rejectBundle.useMutation({
    onSuccess: () => {
      utils.admin.pendingBundles.invalidate();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
  });
  
  const requestChangesMutation = trpc.admin.requestChanges.useMutation({
    onSuccess: () => {
      utils.admin.pendingBundles.invalidate();
      setCommentModalVisible(false);
      setSelectedBundle(null);
      setComments("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const filteredBundles = (bundles as Bundle[]).filter(
    (b) => activeTab === "all" || b.status === activeTab
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleApprove = (bundle: Bundle) => {
    if (Platform.OS === "web") {
      if (window.confirm(`Approve "${bundle.title}"?`)) {
        approveMutation.mutate({ id: bundle.id });
      }
    } else {
      Alert.alert("Approve Bundle", `Approve "${bundle.title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => approveMutation.mutate({ id: bundle.id }),
        },
      ]);
    }
  };

  const handleReject = (bundle: Bundle) => {
    if (Platform.OS === "web") {
      const reason = window.prompt("Reason for rejection:", "");
      if (reason) {
        rejectMutation.mutate({ id: bundle.id, reason });
      }
    } else {
      Alert.prompt(
        "Reject Bundle",
        "Please provide a reason for rejection:",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: (reason: string | undefined) => {
              if (reason) {
                rejectMutation.mutate({ id: bundle.id, reason });
              }
            },
          },
        ],
        "plain-text"
      );
    }
  };

  const handleRequestChanges = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setComments("");
    setCommentModalVisible(true);
  };

  const submitRequestChanges = () => {
    if (selectedBundle && comments.trim()) {
      requestChangesMutation.mutate({ id: selectedBundle.id, comments: comments.trim() });
    }
  };

  const getStatusColor = (status: BundleStatus) => {
    switch (status) {
      case "pending_review":
        return colors.warning;
      case "changes_requested":
        return "#F97316"; // Orange
      case "published":
        return colors.success;
      case "rejected":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const getStatusLabel = (status: BundleStatus) => {
    switch (status) {
      case "pending_review":
        return "Pending Review";
      case "changes_requested":
        return "Changes Requested";
      case "published":
        return "Published";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const getProductCount = (productsJson: any) => {
    if (!productsJson) return 0;
    if (Array.isArray(productsJson)) return productsJson.length;
    return 0;
  };

  const getServiceCount = (servicesJson: any) => {
    if (!servicesJson) return 0;
    if (Array.isArray(servicesJson)) return servicesJson.length;
    return 0;
  };

  const renderBundle = ({ item }: { item: Bundle }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      onPress={() => router.push(`/bundle-editor/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start mb-3">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${colors.primary}20` }}
        >
          <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{item.title}</Text>
          <Text className="text-muted text-sm" numberOfLines={2}>
            {item.description || "No description"}
          </Text>
        </View>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <View className="flex-row items-center mb-1">
          <IconSymbol name="person.fill" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">
            Trainer: {item.trainer?.name || `ID: ${item.trainerId}`}
          </Text>
        </View>
        <View className="flex-row items-center mb-1">
          <IconSymbol name="calendar" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">
            Submitted: {formatDate(item.submittedForReviewAt)}
          </Text>
        </View>
        <View className="flex-row mt-2 gap-3">
          <Text className="text-foreground text-sm">
            Price: <Text className="font-semibold">${item.price || "0"}</Text>
          </Text>
          <Text className="text-foreground text-sm">
            Products: <Text className="font-semibold">{getProductCount(item.productsJson)}</Text>
          </Text>
          <Text className="text-foreground text-sm">
            Services: <Text className="font-semibold">{getServiceCount(item.servicesJson)}</Text>
          </Text>
        </View>
      </View>

      {/* Previous Review Comments */}
      {item.reviewComments && (
        <View className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
          <Text className="text-warning font-medium mb-1">Previous Feedback:</Text>
          <Text className="text-foreground text-sm">{item.reviewComments}</Text>
        </View>
      )}

      {/* Rejection Reason */}
      {item.status === "rejected" && item.rejectionReason && (
        <View className="bg-error/10 border border-error/30 rounded-lg p-3 mb-3">
          <Text className="text-error font-medium mb-1">Rejection Reason:</Text>
          <Text className="text-foreground text-sm">{item.rejectionReason}</Text>
        </View>
      )}

      {/* Action Buttons */}
      {(item.status === "pending_review" || item.status === "changes_requested") && (
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 bg-success py-3 rounded-lg items-center"
            onPress={() => handleApprove(item)}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text className="text-background font-semibold">Approve</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-warning py-3 rounded-lg items-center"
            onPress={() => handleRequestChanges(item)}
            disabled={requestChangesMutation.isPending}
          >
            <Text className="text-background font-semibold">Request Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-error py-3 rounded-lg items-center"
            onPress={() => handleReject(item)}
            disabled={rejectMutation.isPending}
          >
            <Text className="text-background font-semibold">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // Stats
  const stats = {
    pending: (bundles as Bundle[]).filter((b) => b.status === "pending_review").length,
    changesRequested: (bundles as Bundle[]).filter((b) => b.status === "changes_requested").length,
    published: (bundles as Bundle[]).filter((b) => b.status === "published").length,
    rejected: (bundles as Bundle[]).filter((b) => b.status === "rejected").length,
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading approvals...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="py-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Bundle Approvals</Text>
            <Text className="text-muted">Review and approve trainer bundles</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-warning/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-warning">{stats.pending}</Text>
          <Text className="text-xs text-muted">Pending</Text>
        </View>
        <View className="flex-1 bg-orange-500/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold" style={{ color: "#F97316" }}>{stats.changesRequested}</Text>
          <Text className="text-xs text-muted">Changes</Text>
        </View>
        <View className="flex-1 bg-success/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-success">{stats.published}</Text>
          <Text className="text-xs text-muted">Published</Text>
        </View>
        <View className="flex-1 bg-error/10 rounded-xl p-3 items-center">
          <Text className="text-xl font-bold text-error">{stats.rejected}</Text>
          <Text className="text-xs text-muted">Rejected</Text>
        </View>
      </View>

      {/* Status Tabs */}
      <View className="mb-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-2 mr-2 rounded-full ${
                activeTab === item.key ? "bg-primary" : "bg-surface border border-border"
              }`}
              onPress={() => setActiveTab(item.key)}
            >
              <Text
                className={`font-medium ${
                  activeTab === item.key ? "text-background" : "text-foreground"
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Bundles List */}
      <FlatList
        data={filteredBundles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBundle}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
            <Text className="text-muted mt-4 text-center">
              No bundles to review
            </Text>
            <Text className="text-muted text-sm text-center mt-1">
              All bundles have been processed
            </Text>
          </View>
        }
      />

      {/* Request Changes Modal */}
      <Modal
        visible={commentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-md">
            <Text className="text-xl font-bold text-foreground mb-2">Request Changes</Text>
            <Text className="text-muted mb-4">
              Provide feedback for "{selectedBundle?.title}"
            </Text>
            
            <TextInput
              className="bg-background border border-border rounded-lg p-4 text-foreground min-h-[120px] mb-4"
              placeholder="Enter your feedback and requested changes..."
              placeholderTextColor={colors.muted}
              value={comments}
              onChangeText={setComments}
              multiline
              textAlignVertical="top"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border py-3 rounded-lg items-center"
                onPress={() => {
                  setCommentModalVisible(false);
                  setSelectedBundle(null);
                  setComments("");
                }}
              >
                <Text className="text-foreground font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-warning py-3 rounded-lg items-center"
                onPress={submitRequestChanges}
                disabled={!comments.trim() || requestChangesMutation.isPending}
              >
                {requestChangesMutation.isPending ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text className="text-background font-semibold">Send Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
