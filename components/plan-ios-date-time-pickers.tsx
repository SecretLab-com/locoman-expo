import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { ThemeColorPalette } from "@/constants/theme";

const TIME_ITEM_HEIGHT = 44;
const TIME_WHEEL_ROWS = 5;
const TIME_WHEEL_HEIGHT = TIME_ITEM_HEIGHT * TIME_WHEEL_ROWS;

const DATE_ROW_HEIGHT = 48;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildDayRange(minDate: Date, maxDate: Date): Date[] {
  const days: Date[] = [];
  let cur = startOfDay(minDate);
  const end = startOfDay(maxDate);
  while (cur.getTime() <= end.getTime()) {
    days.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return days;
}

type IosTimeWheelPickerProps = {
  colors: ThemeColorPalette;
  /** Time-of-day is read/written on this date instance (local). */
  value: Date;
  onTimeChange: (next: Date) => void;
};

/**
 * iOS-only scroll wheels for hour + minute. Avoids `@react-native-community/datetimepicker`
 * which shows "Unimplemented component: RNDateTimePicker" when the native Fabric view
 * is missing from the current dev-client binary.
 */
export function IosTimeWheelPicker({ colors, value, onTimeChange }: IosTimeWheelPickerProps) {
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const hourIndexRef = useRef(value.getHours());
  const minuteIndexRef = useRef(value.getMinutes());

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const edgePad = (TIME_WHEEL_HEIGHT - TIME_ITEM_HEIGHT) / 2;

  const scrollToSelection = useCallback(
    (hour: number, minute: number, animated: boolean) => {
      hourScrollRef.current?.scrollTo({ y: hour * TIME_ITEM_HEIGHT, animated });
      minuteScrollRef.current?.scrollTo({ y: minute * TIME_ITEM_HEIGHT, animated });
    },
    [],
  );

  useEffect(() => {
    const h = value.getHours();
    const m = value.getMinutes();
    hourIndexRef.current = h;
    minuteIndexRef.current = m;
    const id = requestAnimationFrame(() => {
      scrollToSelection(h, m, false);
    });
    return () => cancelAnimationFrame(id);
  }, [value, scrollToSelection]);

  const commit = useCallback(
    (hour: number, minute: number) => {
      const next = new Date(value);
      next.setHours(hour, minute, 0, 0);
      onTimeChange(next);
    },
    [onTimeChange, value],
  );

  const onHourMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const h = Math.min(23, Math.max(0, Math.round(y / TIME_ITEM_HEIGHT)));
      hourIndexRef.current = h;
      commit(h, minuteIndexRef.current);
    },
    [commit],
  );

  const onMinuteMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const m = Math.min(59, Math.max(0, Math.round(y / TIME_ITEM_HEIGHT)));
      minuteIndexRef.current = m;
      commit(hourIndexRef.current, m);
    },
    [commit],
  );

  const renderTimeColumn = (
    data: number[],
    testID: string,
    onEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
    scrollRef: React.RefObject<ScrollView | null>,
    formatter: (n: number) => string,
  ) => (
    <View style={{ flex: 1, height: TIME_WHEEL_HEIGHT }} accessibilityElementsHidden={false}>
      <ScrollView
        ref={scrollRef}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={TIME_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{
          paddingTop: edgePad,
          paddingBottom: edgePad,
        }}
      >
        {data.map((n) => (
          <View
            key={n}
            style={{
              height: TIME_ITEM_HEIGHT,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text className="text-foreground text-lg tabular-nums">{formatter(n)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View
      className="flex-row items-center justify-center px-2"
      style={{ height: TIME_WHEEL_HEIGHT }}
      accessibilityLabel="Preferred session time, scroll wheels"
    >
      <View
        className="absolute left-0 right-0 opacity-60"
        style={{
          top: (TIME_WHEEL_HEIGHT - TIME_ITEM_HEIGHT) / 2,
          height: TIME_ITEM_HEIGHT,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
        pointerEvents="none"
      />
      {renderTimeColumn(
        hours,
        "plan-ios-time-wheel-hour",
        onHourMomentumEnd,
        hourScrollRef,
        (n) => String(n).padStart(2, "0"),
      )}
      <Text className="text-foreground text-xl font-semibold px-1" style={{ marginTop: -4 }}>
        :
      </Text>
      {renderTimeColumn(
        minutes,
        "plan-ios-time-wheel-minute",
        onMinuteMomentumEnd,
        minuteScrollRef,
        (n) => String(n).padStart(2, "0"),
      )}
    </View>
  );
}

type IosDateListPickerProps = {
  colors: ThemeColorPalette;
  value: Date;
  minDate: Date;
  /** Inclusive end; defaults to ~3 years from min if omitted. */
  maxDate?: Date;
  onDateChange: (next: Date) => void;
};

/**
 * iOS-only day list to avoid native `RNDateTimePicker` when unavailable in the binary.
 */
export function IosDateListPicker({ colors, value, minDate, maxDate, onDateChange }: IosDateListPickerProps) {
  const listRef = useRef<FlatList<Date>>(null);

  const endCap = useMemo(() => {
    if (maxDate) return maxDate;
    const t = startOfDay(minDate);
    return new Date(t.getFullYear() + 3, t.getMonth(), t.getDate());
  }, [maxDate, minDate]);

  const days = useMemo(() => buildDayRange(minDate, endCap), [minDate, endCap]);

  const selectedKey = useMemo(() => startOfDay(value).getTime(), [value]);

  const selectedIndex = useMemo(() => {
    const idx = days.findIndex((d) => startOfDay(d).getTime() === selectedKey);
    return idx < 0 ? 0 : idx;
  }, [days, selectedKey]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: selectedIndex, animated: false });
      } catch {
        listRef.current?.scrollToOffset({ offset: Math.max(0, selectedIndex * DATE_ROW_HEIGHT), animated: false });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex]);

  const renderItem = useCallback(
    ({ item }: { item: Date }) => {
      const isSel = startOfDay(item).getTime() === selectedKey;
      const label = item.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return (
        <View
          style={{
            height: DATE_ROW_HEIGHT,
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <Text
            className={isSel ? "font-semibold text-foreground" : "text-foreground"}
            style={isSel ? { color: colors.tint } : undefined}
          >
            {label}
          </Text>
        </View>
      );
    },
    [colors.tint, selectedKey],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Date> | null | undefined, index: number) => ({
      length: DATE_ROW_HEIGHT,
      offset: DATE_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((d: Date) => String(startOfDay(d).getTime()), []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.min(days.length - 1, Math.max(0, Math.round(y / DATE_ROW_HEIGHT)));
      const picked = days[idx];
      if (picked) {
        const next = startOfDay(picked);
        next.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds());
        onDateChange(next);
      }
    },
    [days, onDateChange, value],
  );

  return (
    <FlatList
      ref={listRef}
      testID="plan-ios-start-date-list"
      data={days}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      showsVerticalScrollIndicator
      style={{ maxHeight: 220 }}
      snapToInterval={DATE_ROW_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScrollToIndexFailed={(info) => {
        const offset = info.averageItemLength * info.index;
        listRef.current?.scrollToOffset({ offset, animated: false });
      }}
      accessibilityLabel="Plan start date list"
    />
  );
}
