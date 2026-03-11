import React from 'react';
import { TextInput, View, type TextInputProps, type ViewProps } from 'react-native';

import { getInputRecipe } from '@/design-system/recipes';
import { useDesignSystem } from '@/hooks/use-design-system';

import { AppText } from './app-text';

type InputProps = TextInputProps & {
  label?: string;
  error?: string | null;
  containerProps?: ViewProps;
};

export function Input({
  label,
  error,
  style,
  containerProps,
  multiline,
  editable = true,
  ...props
}: InputProps) {
  const ds = useDesignSystem();
  const recipe = getInputRecipe(ds, {
    invalid: Boolean(error),
    disabled: !editable,
    multiline,
  });

  return (
    <View {...containerProps}>
      {label ? (
        <AppText variant='label' style={{ marginBottom: ds.spacing[2] }}>
          {label}
        </AppText>
      ) : null}
      <View style={recipe.container}>
        <TextInput
          multiline={multiline}
          editable={editable}
          placeholderTextColor={ds.colors.text.secondary}
          style={[recipe.input, multiline ? { minHeight: 96, textAlignVertical: 'top' } : null, style]}
          {...props}
        />
      </View>
      {error ? (
        <AppText variant='caption' tone='error' style={{ marginTop: ds.spacing[2] }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
