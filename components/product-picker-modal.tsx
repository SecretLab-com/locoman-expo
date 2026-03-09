import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProductCatalogBrowser, type CatalogProduct } from "@/components/product-catalog-browser";
import { useColors } from "@/hooks/use-colors";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ShopifyProduct = {
  id: number;
  title: string;
  vendor: string;
  productType: string;
  price: string;
  sku: string;
  inventory: number;
  imageUrl: string | null;
};

type ProductPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onToggle: (product: ShopifyProduct | CatalogProduct) => void;
  onProductPress?: (product: ShopifyProduct | CatalogProduct) => void;
  excludeBundles?: boolean;
};

export function ProductPickerModal({
  visible,
  onClose,
  selectedIds,
  onToggle,
  onProductPress,
  excludeBundles = true,
}: ProductPickerModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <Text className="text-lg font-semibold text-foreground">Select Products</Text>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ProductCatalogBrowser
            onProductPress={(product) => {
              if (onProductPress) {
                onProductPress(product);
              } else {
                onToggle(product);
              }
            }}
            selectedIds={selectedIds}
            onToggle={onToggle}
            excludeBundles={excludeBundles}
            initialMode="categories"
          />

          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background }}>
            <View className="p-4 border-t border-border">
              <TouchableOpacity className="bg-primary rounded-xl py-4 items-center" onPress={onClose}>
                <Text className="text-background font-semibold">
                  Done ({selectedIds.length} selected)
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
