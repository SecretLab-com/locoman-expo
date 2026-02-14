import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { NavigationHeader } from "@/components/navigation-header";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type GoalType = "weight_loss" | "strength" | "longevity" | "power";

type ServiceItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type ProductItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

type TemplateFormState = {
  title: string;
  description: string;
  goalType: GoalType | null;
  goals: string[];
  imageUrl: string | null;
  basePrice: number;
  services: ServiceItem[];
  products: ProductItem[];
  isActive: boolean;
};

type RecordValue = Record<string, unknown>;

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength" },
  { value: "longevity", label: "Longevity" },
  { value: "power", label: "Power" },
];

const EMPTY_FORM: TemplateFormState = {
  title: "",
  description: "",
  goalType: null,
  goals: [],
  imageUrl: null,
  basePrice: 0,
  services: [],
  products: [],
  isActive: true,
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isGoalType(value: unknown): value is GoalType {
  return value === "weight_loss" || value === "strength" || value === "longevity" || value === "power";
}

function toServiceItem(entry: unknown, index: number): ServiceItem {
  const record = isRecord(entry) ? entry : {};
  const quantity = Math.max(1, Math.round(parseNumber(record.quantity ?? record.count, 1)));

  return {
    id: toStringValue(record.id) || `service-${index}`,
    name: toStringValue(record.name) || toStringValue(record.type) || `Service ${index + 1}`,
    description: toStringValue(record.description),
    quantity,
    unitPrice: Math.max(0, parseNumber(record.unitPrice ?? record.price, 0)),
  };
}

function toProductItem(entry: unknown, index: number): ProductItem {
  const record = isRecord(entry) ? entry : {};
  const quantity = Math.max(1, Math.round(parseNumber(record.quantity, 1)));

  return {
    id: toStringValue(record.id) || `product-${index}`,
    name: toStringValue(record.name) || toStringValue(record.title) || `Product ${index + 1}`,
    sku: toStringValue(record.sku),
    quantity,
    unitPrice: Math.max(0, parseNumber(record.unitPrice ?? record.price, 0)),
  };
}

function toTemplateForm(template: any): TemplateFormState {
  return {
    title: toStringValue(template?.title).trim(),
    description: toStringValue(template?.description),
    goalType: isGoalType(template?.goalType) ? template.goalType : null,
    goals: parseArray(template?.goalsJson)
      .map((goal) => toStringValue(goal).trim())
      .filter((goal) => goal.length > 0),
    imageUrl: toStringValue(template?.imageUrl) || null,
    basePrice: Math.max(0, parseNumber(template?.basePrice, 0)),
    services: parseArray(template?.defaultServices).map(toServiceItem),
    products: parseArray(template?.defaultProducts).map(toProductItem),
    isActive: typeof template?.active === "boolean" ? template.active : true,
  };
}

export default function TemplateEditorScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(id) ? id[0] : id;
  const isNew = idParam === "new";
  const templateId = !isNew && idParam ? idParam : "";

  const [activeTab, setActiveTab] = useState<"details" | "services" | "products">("details");
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);

  const templateQuery = trpc.admin.template.useQuery(
    { id: templateId },
    { enabled: !isNew && Boolean(templateId) }
  );

  const createTemplateMutation = trpc.admin.createTemplate.useMutation();
  const updateTemplateMutation = trpc.admin.updateTemplate.useMutation();
  const isSaving = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  useEffect(() => {
    if (templateQuery.data) {
      setForm(toTemplateForm(templateQuery.data));
    }
  }, [templateQuery.data]);

  const serviceTotal = useMemo(() => {
    return form.services.reduce((sum, service) => sum + service.quantity * service.unitPrice, 0);
  }, [form.services]);

  const productTotal = useMemo(() => {
    return form.products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0);
  }, [form.products]);

  const suggestedPrice = serviceTotal + productTotal;

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Error", "Please enter a template title");
      return;
    }

    if (!isNew && !templateId) {
      Alert.alert("Error", "Invalid template ID");
      return;
    }

    const computedBasePrice = form.basePrice > 0 ? form.basePrice : suggestedPrice;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      goalType: form.goalType ?? undefined,
      goalsJson: form.goals,
      imageUrl: form.imageUrl ?? undefined,
      basePrice: computedBasePrice > 0 ? computedBasePrice.toFixed(2) : undefined,
      defaultServices: form.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        quantity: service.quantity,
        unitPrice: service.unitPrice,
      })),
      defaultProducts: form.products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
      })),
      active: form.isActive,
    };

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isNew) {
        await createTemplateMutation.mutateAsync(payload);
      } else {
        await updateTemplateMutation.mutateAsync({ id: templateId, ...payload });
      }

      await Promise.all([
        utils.admin.templates.invalidate(),
        !isNew && templateId ? utils.admin.template.invalidate({ id: templateId }) : Promise.resolve(),
      ]);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", isNew ? "Template created" : "Template updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error instanceof Error ? error.message : "Failed to save template";
      Alert.alert("Error", message);
    }
  };

  const updateService = (itemId: string, updates: Partial<ServiceItem>) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((service) => (service.id === itemId ? { ...service, ...updates } : service)),
    }));
  };

  const removeService = (itemId: string) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((service) => service.id !== itemId) }));
  };

  const updateProduct = (itemId: string, updates: Partial<ProductItem>) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.map((product) => (product.id === itemId ? { ...product, ...updates } : product)),
    }));
  };

  const removeProduct = (itemId: string) => {
    setForm((prev) => ({ ...prev, products: prev.products.filter((product) => product.id !== itemId) }));
  };

  const addService = () => {
    const newId = `${Date.now()}-service`;
    setForm((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          id: newId,
          name: "New Service",
          description: "",
          quantity: 1,
          unitPrice: 50,
        },
      ],
    }));
  };

  const addProduct = () => {
    const newId = `${Date.now()}-product`;
    setForm((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          id: newId,
          name: "New Product",
          sku: "",
          quantity: 1,
          unitPrice: 29.99,
        },
      ],
    }));
  };

  if (!isNew && templateQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <NavigationHeader
          title="Edit Template"
          showBack
          showHome
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading template...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isNew && templateQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <NavigationHeader
          title="Edit Template"
          showBack
          showHome
        />
        <View className="flex-1 items-center justify-center px-6">
          <IconSymbol name="exclamationmark.triangle.fill" size={32} color={colors.error} />
          <Text className="text-foreground mt-3 font-semibold">Failed to load template</Text>
          <Text className="text-muted text-center mt-1">{templateQuery.error.message}</Text>
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-surface px-4 py-2 rounded-lg"
            >
              <Text className="text-foreground">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => templateQuery.refetch()}
              className="bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={["left", "right"]}>
        <NavigationHeader
          title={isNew ? "New Template" : "Edit Template"}
          showBack
          showHome
          confirmBack={{
            title: "Discard Changes?",
            message: "You have unsaved changes. Are you sure you want to leave?",
            confirmText: "Discard",
            cancelText: "Keep Editing",
          }}
          rightAction={{
            icon: "checkmark",
            onPress: handleSave,
            label: isSaving ? "Saving..." : "Save",
            testID: "template-save",
          }}
        />

        <View className="flex-row border-b border-border">
          {(["details", "services", "products"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-1 py-3"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab ? colors.primary : "transparent",
              }}
            >
              <Text
                className="text-center capitalize"
                style={{
                  color: activeTab === tab ? colors.primary : colors.muted,
                  fontWeight: activeTab === tab ? "600" : "400",
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {activeTab === "details" && (
            <View className="gap-6 pb-8">
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Template Title *</Text>
                <TextInput
                  value={form.title}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
                  placeholder="e.g., Weight Loss Starter Pack"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Description</Text>
                <TextInput
                  value={form.description}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, description: text }))}
                  placeholder="Describe what this template includes..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  style={{ minHeight: 100, textAlignVertical: "top" }}
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Goal Type</Text>
                <View className="flex-row flex-wrap gap-2">
                  {GOAL_TYPES.map((goal) => (
                    <TouchableOpacity
                      key={goal.value}
                      onPress={() => {
                        setForm((prev) => ({ ...prev, goalType: goal.value }));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        backgroundColor: form.goalType === goal.value ? colors.primary : colors.surface,
                        borderWidth: form.goalType === goal.value ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: form.goalType === goal.value ? "#FFFFFF" : colors.foreground,
                          fontWeight: "500",
                        }}
                      >
                        {goal.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Template Status</Text>
                <TouchableOpacity
                  onPress={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
                >
                  <Text className="text-foreground">{form.isActive ? "Active" : "Inactive"}</Text>
                  <IconSymbol
                    name={form.isActive ? "checkmark.circle.fill" : "xmark.circle.fill"}
                    size={20}
                    color={form.isActive ? colors.success : colors.muted}
                  />
                </TouchableOpacity>
              </View>
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Base Price</Text>
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                  <Text className="text-foreground text-lg">$</Text>
                  <TextInput
                    value={form.basePrice > 0 ? form.basePrice.toString() : ""}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, basePrice: parseNumber(text, 0) }))}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    className="flex-1 py-3 ml-1 text-foreground text-lg"
                  />
                </View>
                {suggestedPrice > 0 && (
                  <Text className="text-sm text-muted mt-2">Suggested: ${suggestedPrice.toFixed(2)}</Text>
                )}
              </View>
            </View>
          )}

          {activeTab === "services" && (
            <View className="gap-4 pb-8">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Services (${serviceTotal.toFixed(2)})</Text>
                <TouchableOpacity
                  onPress={addService}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {form.services.map((service) => (
                <View key={service.id} className="bg-surface border border-border rounded-xl p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <TextInput
                      value={service.name}
                      onChangeText={(text) => updateService(service.id, { name: text })}
                      placeholder="Service name"
                      placeholderTextColor={colors.muted}
                      className="flex-1 text-foreground font-medium"
                    />
                    <TouchableOpacity onPress={() => removeService(service.id)}>
                      <IconSymbol name="xmark.circle.fill" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Qty</Text>
                      <View className="flex-row items-center bg-background rounded-lg mt-1">
                        <TouchableOpacity
                          onPress={() => updateService(service.id, { quantity: Math.max(1, service.quantity - 1) })}
                          className="p-2"
                        >
                          <Text className="text-foreground">-</Text>
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-foreground">{service.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateService(service.id, { quantity: service.quantity + 1 })}
                          className="p-2"
                        >
                          <Text className="text-foreground">+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Price</Text>
                      <TextInput
                        value={service.unitPrice.toString()}
                        onChangeText={(text) => updateService(service.id, { unitPrice: parseNumber(text, 0) })}
                        keyboardType="decimal-pad"
                        className="bg-background rounded-lg px-3 py-2 text-foreground mt-1"
                      />
                    </View>
                    <View>
                      <Text className="text-xs text-muted">Total</Text>
                      <Text className="text-primary font-semibold mt-1">${(service.quantity * service.unitPrice).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === "products" && (
            <View className="gap-4 pb-8">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Products (${productTotal.toFixed(2)})</Text>
                <TouchableOpacity
                  onPress={addProduct}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {form.products.map((product) => (
                <View key={product.id} className="bg-surface border border-border rounded-xl p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <TextInput
                      value={product.name}
                      onChangeText={(text) => updateProduct(product.id, { name: text })}
                      placeholder="Product name"
                      placeholderTextColor={colors.muted}
                      className="flex-1 text-foreground font-medium"
                    />
                    <TouchableOpacity onPress={() => removeProduct(product.id)}>
                      <IconSymbol name="xmark.circle.fill" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Qty</Text>
                      <View className="flex-row items-center bg-background rounded-lg mt-1">
                        <TouchableOpacity
                          onPress={() => updateProduct(product.id, { quantity: Math.max(1, product.quantity - 1) })}
                          className="p-2"
                        >
                          <Text className="text-foreground">-</Text>
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-foreground">{product.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateProduct(product.id, { quantity: product.quantity + 1 })}
                          className="p-2"
                        >
                          <Text className="text-foreground">+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Price</Text>
                      <TextInput
                        value={product.unitPrice.toString()}
                        onChangeText={(text) => updateProduct(product.id, { unitPrice: parseNumber(text, 0) })}
                        keyboardType="decimal-pad"
                        className="bg-background rounded-lg px-3 py-2 text-foreground mt-1"
                      />
                    </View>
                    <View>
                      <Text className="text-xs text-muted">Total</Text>
                      <Text className="text-primary font-semibold mt-1">${(product.quantity * product.unitPrice).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View className="px-4 py-4 border-t border-border bg-surface">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-muted">Template Total</Text>
              <Text className="text-2xl font-bold text-foreground">${(form.basePrice || suggestedPrice).toFixed(2)}</Text>
            </View>
            <Text className="text-sm text-muted">{form.services.length} services, {form.products.length} products</Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
