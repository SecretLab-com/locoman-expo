import React from 'react';
import { Sheet as TamaguiSheet, styled, GetProps, YStack, XStack, Text } from 'tamagui';
import { X } from '@tamagui/lucide-icons';
import { Pressable } from 'react-native';

const StyledSheet = styled(TamaguiSheet, {
  name: 'Sheet',
  zIndex: 100000,
});

const StyledOverlay = styled(TamaguiSheet.Overlay, {
  name: 'SheetOverlay',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  animation: 'quick',
  enterStyle: { opacity: 0 },
  exitStyle: { opacity: 0 },
});

const StyledFrame = styled(TamaguiSheet.Frame, {
  name: 'SheetFrame',
  backgroundColor: '$background',
  borderTopLeftRadius: '$6',
  borderTopRightRadius: '$6',
  padding: '$4',
});

const StyledHandle = styled(TamaguiSheet.Handle, {
  name: 'SheetHandle',
  backgroundColor: '$gray8',
  width: 40,
  height: 4,
  borderRadius: '$10',
  marginTop: '$2',
  marginBottom: '$2',
  alignSelf: 'center',
});

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  snapPoints?: number[];
  dismissOnSnapToBottom?: boolean;
  modal?: boolean;
  position?: number;
  onPositionChange?: (position: number) => void;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  snapPoints = [85, 50, 25],
  dismissOnSnapToBottom = true,
  modal = true,
  position,
  onPositionChange,
}: SheetProps) {
  return (
    <StyledSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      dismissOnSnapToBottom={dismissOnSnapToBottom}
      modal={modal}
      position={position}
      onPositionChange={onPositionChange}
    >
      <StyledOverlay />
      <StyledFrame>
        <StyledHandle />
        {children}
      </StyledFrame>
    </StyledSheet>
  );
}

// Sheet Header
interface SheetHeaderProps {
  title?: string;
  description?: string;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function SheetHeader({ title, description, onClose, children }: SheetHeaderProps) {
  return (
    <YStack gap="$2" marginBottom="$4">
      <XStack justifyContent="space-between" alignItems="center">
        {title && (
          <Text fontSize="$6" fontWeight="600" color="$color">
            {title}
          </Text>
        )}
        {onClose && (
          <Pressable onPress={onClose}>
            <X size={24} color="$gray10" />
          </Pressable>
        )}
      </XStack>
      {description && (
        <Text fontSize="$3" color="$gray11">
          {description}
        </Text>
      )}
      {children}
    </YStack>
  );
}

// Sheet Content
export function SheetContent({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1}>
      {children}
    </YStack>
  );
}

// Sheet Footer
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <XStack gap="$3" marginTop="$4" justifyContent="flex-end">
      {children}
    </XStack>
  );
}

export default Sheet;
