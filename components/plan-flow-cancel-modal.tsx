import { useColors } from "@/hooks/use-colors";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

export type PlanFlowCancelPanelProps = {
  /** Close panel and continue the flow */
  onDismiss: () => void;
  clientName: string;
  itemCount: number;
  /** Clear cart + proposal context locally and leave (there is no in-app drafts library today) */
  onDiscardPlan: () => void;
  testID?: string;
};

/**
 * Backdrop + dialog only (no `Modal` wrapper). Use inside an existing modal/window
 * so iOS never stacks two system modals (second modal often ignores touches).
 */
export function PlanFlowCancelPanel({
  onDismiss,
  clientName,
  itemCount,
  onDiscardPlan,
  testID = "plan-flow-cancel-modal",
}: PlanFlowCancelPanelProps) {
  const colors = useColors();
  const name = clientName.trim() || "your client";
  const lines =
    itemCount > 0
      ? `You have ${itemCount} line item${itemCount !== 1 ? "s" : ""} in this plan for ${name}.`
      : `You're building a plan for ${name}.`;

  return (
    <Pressable
      className="flex-1 justify-center items-center px-5"
      style={{ backgroundColor: colors.overlay }}
      onPress={onDismiss}
      accessibilityLabel="Dismiss cancel plan dialog"
      accessibilityRole="button"
    >
      <Pressable
        className="bg-background rounded-2xl w-full overflow-hidden border border-border"
        style={{ maxWidth: 400 }}
        onPress={(e) => e.stopPropagation()}
      >
        <View className="p-5" accessibilityViewIsModal testID={testID}>
          <Text className="text-lg font-bold text-foreground mb-2">Cancel plan?</Text>
          <Text className="text-sm text-muted leading-5 mb-5">
            {lines} The app doesn&apos;t have a drafts library yet—this work only lives on your device
            until you save or send. To leave, discard and clear it.
          </Text>

          <TouchableOpacity
            className="bg-primary rounded-xl py-3.5 items-center mb-2"
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep editing plan"
            testID={`${testID}-keep-editing`}
          >
            <Text className="text-background font-semibold">Keep editing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-error/10 border border-error/40 rounded-xl py-3.5 items-center"
            onPress={onDiscardPlan}
            accessibilityRole="button"
            accessibilityLabel="Discard plan, clear cart, and leave"
            testID={`${testID}-discard`}
          >
            <Text className="text-error font-semibold">Discard & leave</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  );
}

export type PlanFlowCancelModalProps = PlanFlowCancelPanelProps & {
  visible: boolean;
};

/**
 * Confirmed exit for trainer plan flow (intro, shopping, review).
 * Works on web and native (replaces unreliable multi-button Alert on web).
 */
export function PlanFlowCancelModal({
  visible,
  onDismiss,
  clientName,
  itemCount,
  onDiscardPlan,
  testID = "plan-flow-cancel-modal",
}: PlanFlowCancelModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <PlanFlowCancelPanel
        onDismiss={onDismiss}
        clientName={clientName}
        itemCount={itemCount}
        onDiscardPlan={onDiscardPlan}
        testID={testID}
      />
    </Modal>
  );
}
