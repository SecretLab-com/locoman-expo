import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { StyleSheet, TouchableOpacity } from "react-native";

/** Balances header title row; matches close button hit target width/height. */
export const PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH = 40;

export type PlanFlowCloseButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

export type PlanFlowBackButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

function PlanFlowHeaderIconButton({
  onPress,
  accessibilityLabel,
  testID,
  iconName,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
  iconName: "xmark" | "arrow.left";
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{
        width: PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH,
        height: PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH / 2,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <IconSymbol name={iconName} size={18} color={colors.foreground} />
    </TouchableOpacity>
  );
}

/** Identical (x) control for trainer plan flow: intro, shopping, review. */
export function PlanFlowCloseButton({
  onPress,
  accessibilityLabel,
  testID = "plan-flow-close",
}: PlanFlowCloseButtonProps) {
  return (
    <PlanFlowHeaderIconButton
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      iconName="xmark"
    />
  );
}

/** Matching left-arrow control for plan flow step navigation. */
export function PlanFlowBackButton({
  onPress,
  accessibilityLabel,
  testID = "plan-flow-back",
}: PlanFlowBackButtonProps) {
  return (
    <PlanFlowHeaderIconButton
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      iconName="arrow.left"
    />
  );
}
