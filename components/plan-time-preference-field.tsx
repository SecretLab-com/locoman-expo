import DateTimePicker from "@react-native-community/datetimepicker";
import React, { createElement, useCallback, useMemo, useState } from "react";

import { IosTimeWheelPicker } from "@/components/plan-ios-date-time-pickers";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatTimeHHmm, parseTimePreference } from "@/shared/saved-cart-proposal";

function preferenceToWorkingDate(value: string | null | undefined): Date {
  const { hour, minute } = parseTimePreference(value);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTimeButtonLabel(value: string | null | undefined): string {
  const { hour, minute } = parseTimePreference(value);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export type PlanTimePreferenceFieldProps = {
  /** Stored as `HH:mm` (24h) or legacy morning/afternoon/evening. */
  value: string | null | undefined;
  onChange: (hhmm: string) => void;
};

/**
 * Time picker for preferred session time. Native: modal/dialog; web: `input[type=time]`.
 * Parent should render the section label (e.g. "Time Preference").
 */
export function PlanTimePreferenceField({ value, onChange }: PlanTimePreferenceFieldProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const displayLabel = useMemo(() => formatTimeButtonLabel(value), [value]);
  const hhmmValue = useMemo(() => {
    const { hour, minute } = parseTimePreference(value);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }, [value]);

  const [iosOpen, setIosOpen] = useState(false);
  const [iosWorking, setIosWorking] = useState(() => preferenceToWorkingDate(value));
  const [androidOpen, setAndroidOpen] = useState(false);

  const openPicker = () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      setAndroidOpen(true);
      return;
    }
    setIosWorking(preferenceToWorkingDate(value));
    setIosOpen(true);
  };

  const commitTime = useCallback(
    (d: Date) => {
      onChange(formatTimeHHmm(d));
    },
    [onChange],
  );

  const onWebChange = useCallback(
    (e: { target?: { value?: string } }) => {
      const v = e?.target?.value;
      if (!v) return;
      const parts = v.split(":");
      if (parts.length < 2) return;
      const h = Math.min(23, Math.max(0, parseInt(parts[0], 10)));
      const m = Math.min(59, Math.max(0, parseInt(parts[1], 10)));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return;
      onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    },
    [onChange],
  );

  if (Platform.OS === "web") {
    /* DOM `input[type=time]` requires inline styles; not a RN primitive. */
    /* eslint-disable design-system/no-raw-design-values -- web-only native time input */
    const webInput = createElement("input", {
      type: "time",
      value: hhmmValue,
      onChange: onWebChange,
      "aria-label": "Preferred session time",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.foreground,
        fontSize: 16,
      },
    });
    /* eslint-enable design-system/no-raw-design-values */
    return webInput;
  }

  return (
    <View>
      <TouchableOpacity
        onPress={openPicker}
        className="border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
        accessibilityRole="button"
        accessibilityLabel={`Preferred session time ${displayLabel}`}
        testID="plan-time-preference-trigger"
      >
        <Text className="text-foreground font-medium">{displayLabel}</Text>
        <IconSymbol name="clock.fill" size={18} color={colors.muted} />
      </TouchableOpacity>

      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View className="flex-1">
            <Pressable
              className="flex-1 bg-black/50"
              onPress={() => setIosOpen(false)}
              accessibilityLabel="Dismiss time picker"
              accessibilityRole="button"
            />
            <View
              className="bg-background rounded-t-3xl px-4 pt-3 border-t border-border"
              style={{
                paddingBottom: Math.max(insets.bottom, 16),
                maxHeight: windowHeight * 0.42,
              }}
            >
              <View className="flex-row justify-between items-center mb-2">
                <TouchableOpacity
                  onPress={() => setIosOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel time selection"
                >
                  <Text className="text-muted">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-foreground font-semibold">Preferred time</Text>
                <TouchableOpacity
                  onPress={() => {
                    commitTime(iosWorking);
                    setIosOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm preferred time"
                >
                  <Text className="text-primary font-semibold">Done</Text>
                </TouchableOpacity>
              </View>
              <View className="items-center justify-center" style={{ height: 220 }}>
                {/*
                  Native RNDateTimePicker can render "Unimplemented component" on iOS dev builds
                  when the Fabric view isn't in the binary; use JS wheels instead.
                */}
                <IosTimeWheelPicker colors={colors} value={iosWorking} onTimeChange={setIosWorking} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === "android" && androidOpen && (
        <DateTimePicker
          value={preferenceToWorkingDate(value)}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setAndroidOpen(false);
            if (event.type === "dismissed") return;
            if (selectedDate) commitTime(selectedDate);
          }}
        />
      )}
    </View>
  );
}
