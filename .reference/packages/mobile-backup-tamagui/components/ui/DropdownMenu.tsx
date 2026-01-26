import { styled, Popover, YStack, XStack, Text, Separator, GetProps } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';
import { forwardRef, createContext, useContext, useState, ReactNode } from 'react';

// Context for menu state
interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

// Root component
interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
        {children}
      </Popover>
    </DropdownMenuContext.Provider>
  );
}

// Trigger
export const DropdownMenuTrigger = Popover.Trigger;

// Content
export const DropdownMenuContent = styled(Popover.Content, {
  name: 'DropdownMenuContent',
  backgroundColor: '$cardBackground',
  borderRadius: '$3',
  borderWidth: 1,
  borderColor: '$borderColor',
  padding: '$1',
  minWidth: 180,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 5,
  animation: 'fast',
  enterStyle: {
    opacity: 0,
    y: -5,
    scale: 0.95,
  },
  exitStyle: {
    opacity: 0,
    y: -5,
    scale: 0.95,
  },
});

// Item
export const DropdownMenuItem = styled(XStack, {
  name: 'DropdownMenuItem',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  borderRadius: '$2',
  gap: '$2',
  alignItems: 'center',
  cursor: 'pointer',
  
  hoverStyle: {
    backgroundColor: '$backgroundHover',
  },
  
  focusStyle: {
    backgroundColor: '$backgroundHover',
  },

  pressStyle: {
    backgroundColor: '$backgroundHover',
    opacity: 0.9,
  },

  variants: {
    destructive: {
      true: {
        hoverStyle: {
          backgroundColor: '$errorLight',
        },
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        pointerEvents: 'none',
      },
    },
  } as const,
});

// Item Text
export const DropdownMenuItemText = styled(Text, {
  name: 'DropdownMenuItemText',
  fontSize: '$3',
  color: '$color',
  flex: 1,

  variants: {
    destructive: {
      true: {
        color: '$error',
      },
    },
  } as const,
});

// Item with icon helper
interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function MenuItem({
  icon,
  label,
  shortcut,
  onPress,
  destructive,
  disabled,
}: MenuItemProps) {
  const context = useContext(DropdownMenuContext);

  const handlePress = () => {
    onPress?.();
    context?.setOpen(false);
  };

  return (
    <DropdownMenuItem
      onPress={handlePress}
      destructive={destructive}
      disabled={disabled}
    >
      {icon}
      <DropdownMenuItemText destructive={destructive}>
        {label}
      </DropdownMenuItemText>
      {shortcut && (
        <Text fontSize="$1" color="$mutedForeground">
          {shortcut}
        </Text>
      )}
    </DropdownMenuItem>
  );
}

// Checkbox Item
interface CheckboxMenuItemProps extends MenuItemProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function CheckboxMenuItem({
  icon,
  label,
  checked,
  onCheckedChange,
  disabled,
}: CheckboxMenuItemProps) {
  const handlePress = () => {
    onCheckedChange?.(!checked);
  };

  return (
    <DropdownMenuItem onPress={handlePress} disabled={disabled}>
      <XStack width={16} alignItems="center" justifyContent="center">
        {checked && <Check size={14} color="$primary" />}
      </XStack>
      {icon}
      <DropdownMenuItemText>{label}</DropdownMenuItemText>
    </DropdownMenuItem>
  );
}

// Label
export const DropdownMenuLabel = styled(Text, {
  name: 'DropdownMenuLabel',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  fontSize: '$2',
  fontWeight: '600',
  color: '$mutedForeground',
});

// Separator
export const DropdownMenuSeparator = styled(Separator, {
  name: 'DropdownMenuSeparator',
  marginVertical: '$1',
  backgroundColor: '$borderColor',
});

// Group
export const DropdownMenuGroup = styled(YStack, {
  name: 'DropdownMenuGroup',
});

// Sub-menu (simplified - opens inline)
interface SubMenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function SubMenu({ label, icon, children }: SubMenuProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <YStack>
      <DropdownMenuItem onPress={() => setExpanded(!expanded)}>
        {icon}
        <DropdownMenuItemText>{label}</DropdownMenuItemText>
        <Text color="$mutedForeground">›</Text>
      </DropdownMenuItem>
      {expanded && (
        <YStack paddingLeft="$4">
          {children}
        </YStack>
      )}
    </YStack>
  );
}

export type DropdownMenuContentProps = GetProps<typeof DropdownMenuContent>;
export type DropdownMenuItemProps = GetProps<typeof DropdownMenuItem>;

export default DropdownMenu;
