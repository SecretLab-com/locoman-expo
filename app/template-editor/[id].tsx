import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
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

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength" },
  { value: "longevity", label: "Longevity" },
  { value: "power", label: "Power" },
];

const DEFAULT_SERVICES: ServiceItem[] = [
  { id: "1", name: "Personal Training Session", description: "1-hour session", quantity: 4, unitPrice: 75 },
  { id: "2", name: "Nutrition Consultation", description: "30-min consultation", quantity: 2, unitPrice: 50 },
];

const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: "1", name: "Whey Protein", sku: "PROT-001", quantity: 1, unitPrice: 49.99 },
  { id: "2", name: "Pre-Workout", sku: "PRE-001", quantity: 1, unitPrice: 39.99 },
];

export default function TemplateEditorScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [activeTab, setActiveTab] = useState<"details" | "services" | "products">("details");
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<TemplateFormState>({
    title: isNew ? "" : "Weight Loss Starter Pack",
    description: isNew ? "" : "A comprehensive bundle for clients starting their weight loss journey.",
    goalType: isNew ? null : "weight_loss",
    goals: isNew ? [] : ["Lose 10-20 lbs", "Build healthy habits"],
    imageUrl: null,
    basePrice: isNew ? 0 : 299.99,
    services: isNew ? [] : DEFAULT_SERVICES,
    products: isNew ? [] : DEFAULT_PRODUCTS,
    isActive: true,
  });

  const serviceTotal = useMemo(() => {
    return form.services.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
  }, [form.services]);

  const productTotal = useMemo(() => {
    return form.products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  }, [form.products]);

  const suggestedPrice = serviceTotal + productTotal;

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Error", "Please enter a template title");
      return;
    }
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", isNew ? "Template created" : "Template updated", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const removeService = (id: string) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((s) => s.id !== id) }));
  };

  const updateProduct = (id: string, updates: Partial<ProductItem>) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const removeProduct = (id: string) => {
    setForm((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
  };

  const addService = () => {
    const newId = String(Date.now());
    setForm((prev) => ({
      ...prev,
      services: [...prev.services, { id: newId, name: "New Service", description: "", quantity: 1, unitPrice: 50 }],
    }));
  };

  const addProduct = () => {
    const newId = String(Date.now());
    setForm((prev) => ({
      ...prev,
      products: [...prev.products, { id: newId, name: "New Product", sku: "", quantity: 1, unitPrice: 29.99 }],
    }));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-primary ml-1">Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">{isNew ? "New Template" : "Edit Template"}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, opacity: isSaving ? 0.6 : 1 }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>{isSaving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View className="flex-row border-b border-border">
          {(["details", "services", "products"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className="flex-1 py-3"
              style={{ borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.primary : "transparent" }}
            >
              <Text className="text-center capitalize" style={{ color: activeTab === tab ? colors.primary : colors.muted, fontWeight: activeTab === tab ? "600" : "400" }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
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
                      onPress={() => { setForm((prev) => ({ ...prev, goalType: goal.value })); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: form.goalType === goal.value ? colors.primary : colors.surface, borderWidth: form.goalType === goal.value ? 0 : 1, borderColor: colors.border }}
                    >
                      <Text style={{ color: form.goalType === goal.value ? "#FFFFFF" : colors.foreground, fontWeight: "500" }}>{goal.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Base Price</Text>
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                  <Text className="text-foreground text-lg">$</Text>
                  <TextInput
                    value={form.basePrice > 0 ? form.basePrice.toString() : ""}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, basePrice: parseFloat(text) || 0 }))}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    className="flex-1 py-3 ml-1 text-foreground text-lg"
                  />
                </View>
                {suggestedPrice > 0 && <Text className="text-sm text-muted mt-2">Suggested: ${suggestedPrice.toFixed(2)}</Text>}
              </View>
            </View>
          )}

          {activeTab === "services" && (
            <View className="gap-4 pb-8">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Services (${serviceTotal.toFixed(2)})</Text>
                <TouchableOpacity onPress={addService} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {form.services.map((service) => (
                <View key={service.id} className="bg-surface border border-border rounded-xl p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <TextInput value={service.name} onChangeText={(text) => updateService(service.id, { name: text })} placeholder="Service name" placeholderTextColor={colors.muted} className="flex-1 text-foreground font-medium" />
                    <TouchableOpacity onPress={() => removeService(service.id)}><IconSymbol name="xmark.circle.fill" size={24} color={colors.error} /></TouchableOpacity>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Qty</Text>
                      <View className="flex-row items-center bg-background rounded-lg mt-1">
                        <TouchableOpacity onPress={() => updateService(service.id, { quantity: Math.max(1, service.quantity - 1) })} className="p-2"><Text className="text-foreground">-</Text></TouchableOpacity>
                        <Text className="flex-1 text-center text-foreground">{service.quantity}</Text>
                        <TouchableOpacity onPress={() => updateService(service.id, { quantity: service.quantity + 1 })} className="p-2"><Text className="text-foreground">+</Text></TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Price</Text>
                      <TextInput value={service.unitPrice.toString()} onChangeText={(text) => updateService(service.id, { unitPrice: parseFloat(text) || 0 })} keyboardType="decimal-pad" className="bg-background rounded-lg px-3 py-2 text-foreground mt-1" />
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
                <TouchableOpacity onPress={addProduct} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {form.products.map((product) => (
                <View key={product.id} className="bg-surface border border-border rounded-xl p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <TextInput value={product.name} onChangeText={(text) => updateProduct(product.id, { name: text })} placeholder="Product name" placeholderTextColor={colors.muted} className="flex-1 text-foreground font-medium" />
                    <TouchableOpacity onPress={() => removeProduct(product.id)}><IconSymbol name="xmark.circle.fill" size={24} color={colors.error} /></TouchableOpacity>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Qty</Text>
                      <View className="flex-row items-center bg-background rounded-lg mt-1">
                        <TouchableOpacity onPress={() => updateProduct(product.id, { quantity: Math.max(1, product.quantity - 1) })} className="p-2"><Text className="text-foreground">-</Text></TouchableOpacity>
                        <Text className="flex-1 text-center text-foreground">{product.quantity}</Text>
                        <TouchableOpacity onPress={() => updateProduct(product.id, { quantity: product.quantity + 1 })} className="p-2"><Text className="text-foreground">+</Text></TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-muted">Price</Text>
                      <TextInput value={product.unitPrice.toString()} onChangeText={(text) => updateProduct(product.id, { unitPrice: parseFloat(text) || 0 })} keyboardType="decimal-pad" className="bg-background rounded-lg px-3 py-2 text-foreground mt-1" />
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

        {/* Footer */}
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
