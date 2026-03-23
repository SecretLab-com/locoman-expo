import { useCart } from "@/contexts/cart-context";
import BundleDetailScreen from "../../bundle/[id]";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function TrainerBundleDetailScreen() {
  const { proposalContext } = useCart();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (proposalContext?.clientRecordId && id) {
    return <Redirect href={{ pathname: "/bundle/[id]", params: { id } }} />;
  }

  return <BundleDetailScreen />;
}
