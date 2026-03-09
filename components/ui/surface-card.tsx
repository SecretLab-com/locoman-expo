import { cn } from "@/lib/utils";
import type { ViewProps } from "react-native";
import { View } from "react-native";

type SurfaceCardProps = ViewProps & {
  className?: string;
};

export function SurfaceCard({ className, children, ...props }: SurfaceCardProps) {
  return (
    <View className={cn("bg-surface border border-border rounded-xl p-4", className)} {...props}>
      {children}
    </View>
  );
}

