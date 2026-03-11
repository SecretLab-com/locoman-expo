import { useMemo } from 'react';

import { createDesignTokens } from '@/design-system/tokens';
import { useColors } from '@/hooks/use-colors';

export function useDesignSystem() {
  const palette = useColors();
  return useMemo(() => createDesignTokens(palette), [palette]);
}
