import { useState, useMemo } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const CATEGORY_COLORS: Record<string, string> = {
  "Weight Loss": "#EF4444",
  "weight_loss": "#EF4444",
  "Strength": "#3B82F6",
  "strength": "#3B82F6",
  "Cardio": "#F59E0B",
  "Flexibility": "#10B981",
  "longevity": "#10B981",
  "power": "#8B5CF6",
};

export default function TemplatesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const utils = trpc.useUtils();
  const templatesQuery = trpc.bundles.templates.useQuery();
  const templates = templatesQuery.data ?? [];

  // Map API data to expected format
  const mappedTemplates = useMemo(() => {
    return templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      category: t.goalType ?? "General",
      usageCount: t.usageCount ?? 0,
      createdAt: new Date(t.createdAt),
      isActive: t.active,
    }));
  }, [templates]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await utils.bundles.templates.invalidate();
    setRefreshing(false);
  };

  // Delete template
  const handleDelete = (template: typeof mappedTemplates[0]) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${template.title}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // TODO: Call tRPC mutation to delete template when endpoint exists
            Alert.alert("Not implemented", "Template deletion is not yet connected to the API.");
          },
        },
      ]
    );
  };

  // Toggle template active status
  const handleToggleActive = (templateId: string) => {
    // TODO: Call tRPC mutation to toggle template active status when endpoint exists
    Alert.alert("Not implemented", "Template status toggle is not yet connected to the API.");
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (templatesQuery.isLoading) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Bundle Templates</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading templates...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (templatesQuery.isError) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Bundle Templates</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">Failed to load templates</Text>
          <Text className="text-muted text-sm mt-2 text-center">{templatesQuery.error.message}</Text>
          <TouchableOpacity
            onPress={() => templatesQuery.refetch()}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading templates"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Bundle Templates</Text>
            <Text className="text-sm text-muted mt-1">
              {mappedTemplates.length} templates available
            </Text>
          </View>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-xl flex-row items-center"
          onPress={() => router.push("/template-editor/new")}
          accessibilityRole="button"
          accessibilityLabel="Create new template"
        >
          <IconSymbol name="plus" size={18} color="#fff" />
          <Text className="text-white font-semibold ml-1">New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {mappedTemplates.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="doc.text.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No templates yet</Text>
            <Text className="text-muted text-sm text-center mt-1">
              Create templates for trainers to use
            </Text>
          </View>
        ) : (
          mappedTemplates.map((template) => (
            <TouchableOpacity
              key={template.id}
              className="bg-surface rounded-xl p-4 mb-4 border border-border"
              onPress={() => router.push(`/template-editor/${template.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Edit template ${template.title}`}
            >
              {/* Header */}
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-foreground">
                      {template.title}
                    </Text>
                    {!template.isActive && (
                      <View className="bg-muted/20 px-2 py-0.5 rounded ml-2">
                        <Text className="text-xs text-muted">Inactive</Text>
                      </View>
                    )}
                  </View>
                  <View
                    className="px-2 py-0.5 rounded mt-1 self-start"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[template.category] || colors.muted}20`,
                    }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: CATEGORY_COLORS[template.category] || colors.muted }}
                    >
                      {template.category}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              <Text className="text-muted text-sm mb-3">{template.description}</Text>

              {/* Stats */}
              <View className="flex-row items-center mb-3 gap-4">
                <View className="flex-row items-center">
                  <IconSymbol name="doc.text.fill" size={16} color={colors.muted} />
                  <Text className="text-sm text-muted ml-1">
                    Used {template.usageCount} times
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <IconSymbol name="calendar" size={16} color={colors.muted} />
                  <Text className="text-sm text-muted ml-1">
                    {formatDate(template.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row gap-2 pt-3 border-t border-border">
                <TouchableOpacity
                  onPress={() => handleToggleActive(template.id)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    template.isActive ? "bg-warning/10" : "bg-success/10"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={template.isActive ? "Deactivate template" : "Activate template"}
                >
                  <Text
                    className={`font-medium ${
                      template.isActive ? "text-warning" : "text-success"
                    }`}
                  >
                    {template.isActive ? "Deactivate" : "Activate"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert("Edit Template", "Template editing coming soon")}
                  className="flex-1 py-2 rounded-lg items-center bg-primary/10"
                  accessibilityRole="button"
                  accessibilityLabel="Edit template"
                >
                  <Text className="text-primary font-medium">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(template)}
                  className="flex-1 py-2 rounded-lg items-center bg-error/10"
                  accessibilityRole="button"
                  accessibilityLabel="Delete template"
                >
                  <Text className="text-error font-medium">Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
