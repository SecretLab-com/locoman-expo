import { styled, XStack, GetProps } from 'tamagui';
import { Search, X } from '@tamagui/lucide-icons';
import { forwardRef, useState } from 'react';
import { Input, StyledInput } from './Input';
import { Button } from './Button';

// Search input container
const SearchContainer = styled(XStack, {
  name: 'SearchContainer',
  alignItems: 'center',
  position: 'relative',
});

// Search Input component
interface SearchInputProps extends Omit<GetProps<typeof StyledInput>, 'value' | 'onChangeText'> {
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  debounceMs?: number;
  showClearButton?: boolean;
}

export const SearchInput = forwardRef<typeof StyledInput, SearchInputProps>(
  (
    {
      value = '',
      onChangeText,
      onSearch,
      onClear,
      placeholder = 'Search...',
      debounceMs = 300,
      showClearButton = true,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState(value);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const handleChange = (text: string) => {
      setLocalValue(text);
      onChangeText?.(text);

      // Debounced search
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      if (onSearch) {
        const timer = setTimeout(() => {
          onSearch(text);
        }, debounceMs);
        setDebounceTimer(timer);
      }
    };

    const handleClear = () => {
      setLocalValue('');
      onChangeText?.('');
      onSearch?.('');
      onClear?.();
    };

    const handleSubmit = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      onSearch?.(localValue);
    };

    return (
      <SearchContainer>
        <Search
          size={18}
          color="$mutedForeground"
          position="absolute"
          left="$3"
          zIndex={1}
        />
        <StyledInput
          ref={ref}
          value={localValue}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          paddingLeft="$9"
          paddingRight={showClearButton && localValue ? '$9' : '$3'}
          flex={1}
          returnKeyType="search"
          {...props}
        />
        {showClearButton && localValue.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onPress={handleClear}
            position="absolute"
            right="$1"
            padding="$1"
          >
            <X size={16} color="$mutedForeground" />
          </Button>
        )}
      </SearchContainer>
    );
  }
);

SearchInput.displayName = 'SearchInput';

// Expandable search (icon that expands to input)
interface ExpandableSearchProps extends SearchInputProps {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function ExpandableSearch({
  expanded: controlledExpanded,
  onExpandedChange,
  ...props
}: ExpandableSearchProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onPress={() => setExpanded(true)}
      >
        <Search size={20} color="$color" />
      </Button>
    );
  }

  return (
    <XStack flex={1} gap="$2" alignItems="center">
      <SearchInput
        {...props}
        autoFocus
        flex={1}
        onClear={() => {
          props.onClear?.();
          setExpanded(false);
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        onPress={() => setExpanded(false)}
      >
        Cancel
      </Button>
    </XStack>
  );
}

export default SearchInput;
