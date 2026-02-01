import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function ManagerProductsScreen() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-lg font-semibold text-foreground">Products</Text>
      <Text className="text-muted text-center mt-2">
        Use the shared catalog for product browsing and cart actions.
      </Text>
      <TouchableOpacity
        className="mt-4 px-4 py-2 rounded-lg border border-border bg-surface"
        onPress={() => router.push("/(tabs)/products" as any)}
        accessibilityRole="button"
        accessibilityLabel="Go to products"
        testID="manager-products-go"
      >
        <Text className="text-foreground">Go to Products</Text>
      </TouchableOpacity>
    </View>
  );
}
