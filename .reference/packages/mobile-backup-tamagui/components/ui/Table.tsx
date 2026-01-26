import { styled, YStack, XStack, Text, ScrollView, GetProps } from 'tamagui';
import { ReactNode } from 'react';

// Table container
export const Table = styled(YStack, {
  name: 'Table',
  backgroundColor: '$cardBackground',
  borderRadius: '$3',
  borderWidth: 1,
  borderColor: '$cardBorder',
  overflow: 'hidden',
});

// Table Header
export const TableHeader = styled(XStack, {
  name: 'TableHeader',
  backgroundColor: '$muted',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  borderBottomWidth: 1,
  borderBottomColor: '$borderColor',
});

// Table Header Cell
export const TableHead = styled(Text, {
  name: 'TableHead',
  fontSize: '$2',
  fontWeight: '600',
  color: '$mutedForeground',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
});

// Table Body
export const TableBody = styled(YStack, {
  name: 'TableBody',
});

// Table Row
export const TableRow = styled(XStack, {
  name: 'TableRow',
  paddingHorizontal: '$3',
  paddingVertical: '$3',
  borderBottomWidth: 1,
  borderBottomColor: '$borderColor',
  alignItems: 'center',

  variants: {
    pressable: {
      true: {
        cursor: 'pointer',
        hoverStyle: {
          backgroundColor: '$backgroundHover',
        },
        pressStyle: {
          backgroundColor: '$backgroundHover',
          opacity: 0.9,
        },
      },
    },
    selected: {
      true: {
        backgroundColor: '$primaryLight',
      },
    },
  } as const,
});

// Table Cell
export const TableCell = styled(Text, {
  name: 'TableCell',
  fontSize: '$3',
  color: '$color',
});

// Table Footer
export const TableFooter = styled(XStack, {
  name: 'TableFooter',
  backgroundColor: '$muted',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  borderTopWidth: 1,
  borderTopColor: '$borderColor',
  alignItems: 'center',
  justifyContent: 'space-between',
});

// Empty state
export const TableEmpty = styled(YStack, {
  name: 'TableEmpty',
  padding: '$6',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
});

export const TableEmptyText = styled(Text, {
  name: 'TableEmptyText',
  fontSize: '$3',
  color: '$mutedForeground',
  textAlign: 'center',
});

// Responsive table wrapper (horizontal scroll on mobile)
interface ResponsiveTableProps {
  children: ReactNode;
  minWidth?: number;
}

export function ResponsiveTable({ children, minWidth = 600 }: ResponsiveTableProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <YStack minWidth={minWidth}>
        {children}
      </YStack>
    </ScrollView>
  );
}

// Column definition for typed tables
interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number | string;
  flex?: number;
  render?: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

// Typed table component
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string;
  onRowPress?: (item: T, index: number) => void;
  selectedKey?: string;
  emptyMessage?: string;
  loading?: boolean;
  footer?: ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowPress,
  selectedKey,
  emptyMessage = 'No data available',
  loading,
  footer,
}: DataTableProps<T>) {
  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'center';
      case 'right':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  };

  return (
    <Table>
      <TableHeader>
        {columns.map((col) => (
          <XStack
            key={String(col.key)}
            width={col.width}
            flex={col.flex ?? 1}
            justifyContent={getAlignment(col.align)}
          >
            <TableHead>{col.header}</TableHead>
          </XStack>
        ))}
      </TableHeader>

      <TableBody>
        {data.length === 0 ? (
          <TableEmpty>
            <TableEmptyText>{emptyMessage}</TableEmptyText>
          </TableEmpty>
        ) : (
          data.map((item, index) => {
            const key = keyExtractor(item, index);
            return (
              <TableRow
                key={key}
                pressable={!!onRowPress}
                selected={key === selectedKey}
                onPress={() => onRowPress?.(item, index)}
              >
                {columns.map((col) => (
                  <XStack
                    key={String(col.key)}
                    width={col.width}
                    flex={col.flex ?? 1}
                    justifyContent={getAlignment(col.align)}
                  >
                    {col.render ? (
                      col.render(item, index)
                    ) : (
                      <TableCell>
                        {String((item as Record<string, unknown>)[col.key as string] ?? '')}
                      </TableCell>
                    )}
                  </XStack>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>

      {footer && <TableFooter>{footer}</TableFooter>}
    </Table>
  );
}

export type TableProps = GetProps<typeof Table>;
export type TableRowProps = GetProps<typeof TableRow>;
export type TableCellProps = GetProps<typeof TableCell>;

export default Table;
