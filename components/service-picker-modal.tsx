import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { SERVICE_SUGGESTIONS } from "@/shared/service-suggestions";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ServicePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
  /** Extra service names to show (e.g. from trainer bundles). */
  extraServices?: string[];
  /** Currently selected name, to show a checkmark. */
  selectedName?: string | null;
  /** "pageSheet" for full-page (editors), "bottomSheet" for transparent overlay (request-payment). Default: "pageSheet". */
  presentation?: "pageSheet" | "bottomSheet";
};

export function ServicePickerModal({
  visible,
  onClose,
  onSelect,
  extraServices = [],
  selectedName,
  presentation = "pageSheet",
}: ServicePickerModalProps) {
  const colors = useColors();
  const [customInput, setCustomInput] = useState("");

  const handleSelect = (name: string) => {
    onSelect(name);
    setCustomInput("");
  };

  const handleCustomAdd = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    setCustomInput("");
  };

  const content = (
    <>
      <View className={`${presentation === "bottomSheet" ? "px-5 pb-2" : "px-4 py-4 border-b border-border"} flex-row items-center justify-between`}>
        <Text className="text-lg font-bold text-foreground">
          {presentation === "bottomSheet" ? "Select a service" : "Add Service"}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close service picker"
          testID="service-picker-close"
        >
          <IconSymbol name="xmark" size={22} color={presentation === "bottomSheet" ? colors.muted : colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className={presentation === "bottomSheet" ? "px-5 pb-6" : "flex-1 p-4"}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs text-muted mb-3">Select a service type or create a custom one</Text>

        <View className="gap-2 mb-3">
          {SERVICE_SUGGESTIONS.map((name) => {
            const active = selectedName === name;
            return (
              <TouchableOpacity
                key={name}
                className="bg-surface border border-border rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                onPress={() => handleSelect(name)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${name}`}
              >
                <Text className="text-foreground font-medium text-sm">{name}</Text>
                {active ? (
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                ) : (
                  <IconSymbol name="plus" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {extraServices.length > 0 && (
          <>
            <Text className="text-xs text-muted mb-2 mt-1">From your bundles</Text>
            <View className="gap-2 mb-3">
              {extraServices.map((name) => {
                const active = selectedName === name;
                return (
                  <TouchableOpacity
                    key={name}
                    className="bg-surface border border-border rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                    onPress={() => handleSelect(name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${name}`}
                  >
                    <Text className="text-foreground font-medium text-sm">{name}</Text>
                    {active ? (
                      <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                    ) : (
                      <IconSymbol name="plus" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text className="text-xs text-muted mb-2 mt-1">Custom service</Text>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            placeholder="Custom service name…"
            placeholderTextColor={colors.muted}
            value={customInput}
            onChangeText={setCustomInput}
          />
          <TouchableOpacity
            className="bg-primary rounded-xl px-4 items-center justify-center"
            onPress={handleCustomAdd}
            disabled={!customInput.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add custom service"
            testID="service-picker-custom-add"
          >
            <IconSymbol name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </>
  );

  if (presentation === "bottomSheet") {
    const isDark = colors.foreground === "#FFFFFF";
    const overlayColor = isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(15, 23, 42, 0.18)";

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: overlayColor }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "75%" }}>
            <View className="items-center py-2">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(148,163,184,0.55)" }} />
            </View>
            {content}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {content}
      </View>
    </Modal>
  );
}
