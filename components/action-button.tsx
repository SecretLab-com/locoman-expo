import React from "react";
import { HapticButton } from "./haptic-button";

type HapticButtonProps = React.ComponentProps<typeof HapticButton>;

interface ActionButtonProps extends Omit<HapticButtonProps, "loading"> {
  loading?: boolean;
}

/**
 * Thin wrapper around HapticButton for mutation-backed actions.
 * Pass `loading={mutation.isPending}` for automatic spinner + disabled state.
 *
 * @example
 * <ActionButton
 *   onPress={() => saveMutation.mutate(data)}
 *   loading={saveMutation.isPending}
 *   loadingText="Saving..."
 * >
 *   Save
 * </ActionButton>
 */
export function ActionButton({
  loading = false,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <HapticButton loading={loading} {...props}>
      {children}
    </HapticButton>
  );
}
