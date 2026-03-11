import { useColors } from "@/hooks/use-colors";
import { useDesignSystem } from "@/hooks/use-design-system";
import { registerInAppAlertHandler, type InAppAlertRequest } from "@/lib/in-app-alert";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

export function InAppAlertHost() {
  const colors = useColors();
  const ds = useDesignSystem();
  const [queue, setQueue] = useState<InAppAlertRequest[]>([]);

  useEffect(() => {
    return registerInAppAlertHandler((request) => {
      setQueue((prev) => [...prev, request]);
    });
  }, []);

  const current = queue[0] || null;
  const buttons = useMemo(() => {
    if (!current) return [];
    if (current.buttons && current.buttons.length > 0) return current.buttons;
    return [{ text: "OK" }];
  }, [current]);

  const closeCurrent = () => {
    setQueue((prev) => prev.slice(1));
  };

  const handlePress = (index: number) => {
    const action = buttons[index];
    closeCurrent();
    action?.onPress?.();
  };

  const canDismissByBackdrop = Boolean(current?.options?.cancelable);

  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (canDismissByBackdrop) closeCurrent();
      }}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: ds.colors.overlay.scrim,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
        onPress={() => {
          if (canDismissByBackdrop) closeCurrent();
        }}
      >
        <Pressable
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 14,
          }}
        >
          {current?.title ? (
            <Text className="text-foreground text-lg font-semibold">{current.title}</Text>
          ) : null}
          {current?.message ? (
            <Text className="text-foreground text-sm mt-2 leading-6">{current.message}</Text>
          ) : null}

          <View className="flex-row justify-end mt-5">
            {buttons.map((button, index) => {
              const isDestructive = button.style === "destructive";
              const isCancel = button.style === "cancel";
              return (
                <TouchableOpacity
                  key={`${button.text || "button"}-${index}`}
                  onPress={() => handlePress(index)}
                  className="ml-2 px-4 py-2 rounded-lg"
                  style={{
                    borderWidth: 1,
                    borderColor: isDestructive ? colors.error : colors.border,
                    backgroundColor: isCancel ? colors.surface : "transparent",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={button.text || "Dialog button"}
                  testID={`in-app-alert-btn-${index}`}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isDestructive ? colors.error : colors.primary }}
                  >
                    {button.text || "OK"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

