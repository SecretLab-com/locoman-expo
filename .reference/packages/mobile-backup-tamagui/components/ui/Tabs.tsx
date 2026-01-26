import { styled, Tabs as TamaguiTabs, GetProps } from 'tamagui';

// Tabs Root
export const Tabs = styled(TamaguiTabs, {
  name: 'Tabs',
  flexDirection: 'column',
  width: '100%',
});

// Tabs List (container for triggers)
export const TabsList = styled(TamaguiTabs.List, {
  name: 'TabsList',
  flexDirection: 'row',
  backgroundColor: '$muted',
  borderRadius: '$3',
  padding: '$1',
  gap: '$1',

  variants: {
    variant: {
      default: {
        backgroundColor: '$muted',
      },
      outline: {
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: '$borderColor',
        borderRadius: 0,
        padding: 0,
      },
      pills: {
        backgroundColor: 'transparent',
        gap: '$2',
        padding: 0,
      },
    },
    fullWidth: {
      true: {
        width: '100%',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
});

// Tab Trigger (individual tab button)
export const TabsTrigger = styled(TamaguiTabs.Tab, {
  name: 'TabsTrigger',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  borderRadius: '$2',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',

  hoverStyle: {
    backgroundColor: '$backgroundHover',
  },

  variants: {
    variant: {
      default: {
        // Active state handled by data attribute
      },
      outline: {
        borderRadius: 0,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        marginBottom: -1,
      },
      pills: {
        borderRadius: '$4',
        paddingHorizontal: '$4',
      },
    },
    active: {
      true: {
        backgroundColor: '$background',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    },
    fullWidth: {
      true: {
        flex: 1,
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
});

// Tab Trigger Text
export const TabsTriggerText = styled(TamaguiTabs.Tab, {
  name: 'TabsTriggerText',
  fontSize: '$3',
  fontWeight: '500',
  color: '$mutedForeground',

  variants: {
    active: {
      true: {
        color: '$color',
      },
    },
  } as const,
});

// Tab Content
export const TabsContent = styled(TamaguiTabs.Content, {
  name: 'TabsContent',
  paddingTop: '$4',
  flex: 1,
});

// Helper component for complete tab setup
interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface TabsFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  variant?: 'default' | 'outline' | 'pills';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function TabsField({
  value,
  onValueChange,
  items,
  variant = 'default',
  fullWidth,
  children,
}: TabsFieldProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList variant={variant} fullWidth={fullWidth}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            variant={variant}
            active={value === item.value}
            fullWidth={fullWidth}
            disabled={item.disabled}
          >
            {item.icon}
            <TabsTriggerText active={value === item.value}>
              {item.label}
            </TabsTriggerText>
            {item.badge}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export type TabsProps = GetProps<typeof Tabs>;
export type TabsListProps = GetProps<typeof TabsList>;
export type TabsTriggerProps = GetProps<typeof TabsTrigger>;
export type TabsContentProps = GetProps<typeof TabsContent>;

export default Tabs;
