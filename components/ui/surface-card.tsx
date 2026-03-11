import { cn } from "@/lib/utils";
import type { ViewProps } from "react-native";
import { View } from "react-native";

import { getSurfaceRecipe, type SurfaceTone } from "@/design-system/recipes";
import { useDesignSystem } from "@/hooks/use-design-system";

type SurfaceCardProps = ViewProps & {
  className?: string;
  tone?: SurfaceTone;
  elevated?: boolean;
  border?: "none" | "subtle" | "default" | "strong";
};

export function SurfaceCard({
  className,
  children,
  style,
  tone = "default",
  elevated = false,
  border = "default",
  ...props
}: SurfaceCardProps) {
  const ds = useDesignSystem();
  return (
    <View
      className={cn(className)}
      style={[getSurfaceRecipe(ds, { tone, border, elevated }), style]}
      {...props}
    >
      {children}
    </View>
  );
}

