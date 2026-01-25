// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation icons
  "house.fill": "home",
  "cart.fill": "shopping-cart",
  "person.fill": "person",
  "gearshape.fill": "settings",
  "chart.bar.fill": "bar-chart",
  "list.bullet": "list",
  "rectangle.grid.2x2.fill": "grid-view",
  "person.2.fill": "people",
  "dollarsign.circle.fill": "attach-money",
  "calendar": "calendar-today",
  "message.fill": "message",
  "shippingbox.fill": "local-shipping",
  "bag.fill": "shopping-bag",
  "creditcard.fill": "credit-card",
  
  // Action icons
  "paperplane.fill": "send",
  "plus": "add",
  "minus": "remove",
  "xmark": "close",
  "checkmark": "check",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "chevron.left": "chevron-left",
  "chevron.right": "chevron-right",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "chevron.left.forwardslash.chevron.right": "code",
  "magnifyingglass": "search",
  "trash.fill": "delete",
  "pencil": "edit",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "star.fill": "star",
  "star": "star-border",
  
  // Status icons
  "exclamationmark.triangle.fill": "warning",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "info.circle.fill": "info",
  
  // Misc icons
  "photo.fill": "photo",
  "camera.fill": "camera-alt",
  "clock.fill": "schedule",
  "location.fill": "location-on",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "lock.fill": "lock",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
