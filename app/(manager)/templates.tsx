import { useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type Template = {
  id: number;
  title: string;
  description: string;
  category: string;
  usageCount: number;
  createdAt: Date;
  isActive: boolean;
};

// Mock data
const MOCK_TEMPLATES: Template[] = [
  {
    id: 1,
    title: "Weight Loss Starter",
    description: "12-week program with nutrition guide and workout plan",
    category: "Weight Loss",
    usageCount: 45,
    createdAt: new Date(Date.now() - 86400000 * 90),
    isActive: true,
  },
  {
    id: 2,
    title: "Strength Foundation",
    description: "8-week strength building program for beginners",
    category: "Strength",
    usageCount: 32,
    createdAt: new Date(Date.now() - 86400000 * 60),
    isActive: true,
  },
  {
    id: 3,
    title: "HIIT Express",
    description: "4-week high-intensity interval training program",
    category: "Cardio",
    usageCount: 28,
    createdAt: new Date(Date.now() - 86400000 * 45),
    isActive: true,
  },
  {
    id: 4,
    title: "Yoga Journey",
    description: "6-week yoga and flexibility program",
    category: "Flexibility",
    usageCount: 19,
    createdAt: new Date(Date.now() - 86400000 * 30),
    isActive: false,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Weight Loss": "#EF4444",
  "Strength": "#3B82F6",
  "Cardio": "#F59E0B",
  "Flexibility": "#10B981",
};

export default function TemplatesScreen() {
  const colors = useColors();
  const [templates, setTemplates] = useState<Template[]>(MOCK_TEMPLATES);
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Toggle template active status
  const handleToggleActive = (templateId: number) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, isActive: !t.isActive } : t
      )
    );
  };

  // Delete template
  const handleDelete = (template: Template) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${template.title}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
          },
        },
      ]
    );
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Bundle Templates</Text>
          <Text className="text-sm text-muted mt-1">
            {templates.length} templates available
          </Text>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-xl flex-row items-center"
          onPress={() => router.push("/template-editor/new")}
        >
          <IconSymbol name="plus" size={18} color="#fff" />
          <Text className="text-white font-semibold ml-1">New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {templates.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="doc.text.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No templates yet</Text>
            <Text className="text-muted text-sm text-center mt-1">
              Create templates for trainers to use
            </Text>
          </View>
        ) : (
          templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              className="bg-surface rounded-xl p-4 mb-4 border border-border"
              onPress={() => router.push(`/template-editor/${template.id}`)}
              activeOpacity={0.7}
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
                      className="text-xs font-medium"
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
                >
                  <Text className="text-primary font-medium">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(template)}
                  className="flex-1 py-2 rounded-lg items-center bg-error/10"
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
