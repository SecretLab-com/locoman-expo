import React from 'react';
import { Text, type TextProps } from 'react-native';

import { getTypographyStyle, type TextTone, type TextVariant, type TextWeight } from '@/design-system/typography';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  className?: string;
};

export function AppText({
  variant = 'body',
  tone = 'default',
  weight,
  className,
  style,
  children,
  ...props
}: AppTextProps) {
  const colors = useColors();
  return (
    <Text
      className={cn(className)}
      style={[getTypographyStyle({ palette: colors, variant, tone, weight }), style]}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Heading(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant='h2' weight='bold' {...props} />;
}

export function Body(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant='body' {...props} />;
}

export function Label(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant='label' weight='semibold' {...props} />;
}

export function Caption(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant='caption' tone='secondary' {...props} />;
}
