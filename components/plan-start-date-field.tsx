import DateTimePicker from "@react-native-community/datetimepicker";
import React, { createElement, useCallback, useMemo, useState } from "react";

import { IosDateListPicker } from "@/components/plan-ios-date-time-pickers";
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

function parseIsoToDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export type PlanStartDateFieldProps = {
  valueIso: string | null | undefined;
  onChangeIso: (iso: string) => void;
};

/**
 * Calendar-based plan start date: native iOS (inline) / Android (Material) pickers;
 * web uses HTML date input. Parent should render the "Start Date" label.
 */
export function PlanStartDateField({ valueIso, onChangeIso }: PlanStartDateFieldProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const date = useMemo(() => parseIsoToDate(valueIso), [valueIso]);
  const minDate = useMemo(() => startOfToday(), []);

  const [iosOpen, setIosOpen] = useState(false);
  const [iosWorking, setIosWorking] = useState(date);
  const [androidOpen, setAndroidOpen] = useState(false);

  const displayLabel = useMemo(
    () =>
      date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [date],
  );

  const openPicker = () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      setAndroidOpen(true);
      return;
    }
    setIosWorking(date);
    setIosOpen(true);
  };

  const onWebChange = useCallback(
    (e: { target?: { value?: string } }) => {
      const v = e?.target?.value;
      if (v) onChangeIso(new Date(`${v}T12:00:00.000Z`).toISOString());
    },
    [onChangeIso],
  );

  if (Platform.OS === "web") {
    const ymd = formatYMD(date);
    /* DOM `input[type=date]` requires inline styles; not a RN primitive. */
    /* eslint-disable design-system/no-raw-design-values -- web-only native date input */
    const webInput = createElement("input", {
      type: "date",
      value: ymd,
      min: formatYMD(minDate),
      onChange: onWebChange,
      "aria-label": "Plan start date",
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
        accessibilityLabel={`Plan start date, ${displayLabel}`}
        testID="plan-start-date-trigger"
      >
        <Text className="text-foreground font-medium">{displayLabel}</Text>
        <IconSymbol name="calendar" size={18} color={colors.muted} />
      </TouchableOpacity>

      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View className="flex-1">
            <Pressable
              className="flex-1 bg-black/50"
              onPress={() => setIosOpen(false)}
              accessibilityLabel="Dismiss date picker"
              accessibilityRole="button"
            />
            {/*
              iOS: `display="inline"` calendar inside RN Modal is unreliable (zero / clipped layout).
              Use the wheel (`spinner`) like time — consistent and always visible.
            */}
            <View
              className="bg-background rounded-t-3xl border-t border-border"
              style={{
                paddingBottom: Math.max(insets.bottom, 16),
                maxHeight: windowHeight * 0.42,
              }}
            >
              <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
                <TouchableOpacity
                  onPress={() => setIosOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel date selection"
                >
                  <Text className="text-muted">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-foreground font-semibold">Start date</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChangeIso(iosWorking.toISOString());
                    setIosOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm start date"
                >
                  <Text className="text-primary font-semibold">Done</Text>
                </TouchableOpacity>
              </View>
              <View className="items-stretch px-2" style={{ height: 220 }}>
                {/*
                  Avoid iOS RNDateTimePicker when native view is missing from the dev binary.
                */}
                <IosDateListPicker
                  colors={colors}
                  value={iosWorking}
                  minDate={minDate}
                  onDateChange={setIosWorking}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === "android" && androidOpen && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={(event, selectedDate) => {
            setAndroidOpen(false);
            if (event.type === "dismissed") return;
            if (selectedDate) onChangeIso(selectedDate.toISOString());
          }}
        />
      )}
    </View>
  );
}
