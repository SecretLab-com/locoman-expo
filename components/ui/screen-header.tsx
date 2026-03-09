import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
  leftSlot,
  rightSlot,
}: ScreenHeaderProps) {
  return (
    <View className={cn("px-4 pt-2 pb-4", className)}>
      <View className="flex-row items-center justify-between">
        {leftSlot ? <View className="mr-3">{leftSlot}</View> : null}
        <View className="flex-1 pr-3">
          <Text className={cn("text-2xl font-bold text-foreground", titleClassName)}>{title}</Text>
          {subtitle ? <Text className={cn("text-sm text-muted mt-1", subtitleClassName)}>{subtitle}</Text> : null}
        </View>
        {rightSlot ? <View className="ml-3">{rightSlot}</View> : null}
      </View>
    </View>
  );
}
