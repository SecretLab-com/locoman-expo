/**
 * Tamagui Compatibility Layer
 * 
 * This file provides React Native equivalents for Tamagui primitives,
 * allowing gradual migration away from Tamagui.
 */

import React from 'react';
import { 
  View, 
  Text as RNText, 
  ScrollView as RNScrollView,
  Image as RNImage,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  ActivityIndicator,
} from 'react-native';

// Common style prop types
interface CommonStyleProps {
  padding?: number | string;
  paddingHorizontal?: number | string;
  paddingVertical?: number | string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  paddingRight?: number | string;
  margin?: number | string;
  marginHorizontal?: number | string;
  marginVertical?: number | string;
  marginTop?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  marginRight?: number | string;
  gap?: number;
  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  position?: 'absolute' | 'relative';
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  overflow?: 'hidden' | 'visible' | 'scroll';
  opacity?: number;
  zIndex?: number;
}

interface StackProps extends CommonStyleProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  animation?: string;
  enterStyle?: ViewStyle;
  exitStyle?: ViewStyle;
}

// Convert Tamagui token values to actual values
function parseValue(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  
  // Handle Tamagui tokens like '$4', '$3', etc.
  if (typeof value === 'string' && value.startsWith('$')) {
    const num = parseInt(value.slice(1), 10);
    return num * 4; // Approximate token to pixel conversion
  }
  
  // Handle percentage strings
  if (typeof value === 'string' && value.endsWith('%')) {
    return undefined; // Let React Native handle percentage strings
  }
  
  return parseInt(value, 10) || 0;
}

function buildViewStyle(props: CommonStyleProps): ViewStyle {
  const style: ViewStyle = {};
  
  if (props.padding !== undefined) style.padding = parseValue(props.padding);
  if (props.paddingHorizontal !== undefined) style.paddingHorizontal = parseValue(props.paddingHorizontal);
  if (props.paddingVertical !== undefined) style.paddingVertical = parseValue(props.paddingVertical);
  if (props.paddingTop !== undefined) style.paddingTop = parseValue(props.paddingTop);
  if (props.paddingBottom !== undefined) style.paddingBottom = parseValue(props.paddingBottom);
  if (props.paddingLeft !== undefined) style.paddingLeft = parseValue(props.paddingLeft);
  if (props.paddingRight !== undefined) style.paddingRight = parseValue(props.paddingRight);
  if (props.margin !== undefined) style.margin = parseValue(props.margin);
  if (props.marginHorizontal !== undefined) style.marginHorizontal = parseValue(props.marginHorizontal);
  if (props.marginVertical !== undefined) style.marginVertical = parseValue(props.marginVertical);
  if (props.marginTop !== undefined) style.marginTop = parseValue(props.marginTop);
  if (props.marginBottom !== undefined) style.marginBottom = parseValue(props.marginBottom);
  if (props.marginLeft !== undefined) style.marginLeft = parseValue(props.marginLeft);
  if (props.marginRight !== undefined) style.marginRight = parseValue(props.marginRight);
  if (props.gap !== undefined) style.gap = props.gap;
  if (props.flex !== undefined) style.flex = props.flex;
  if (props.flexDirection !== undefined) style.flexDirection = props.flexDirection;
  if (props.alignItems !== undefined) style.alignItems = props.alignItems;
  if (props.justifyContent !== undefined) style.justifyContent = props.justifyContent;
  if (props.backgroundColor !== undefined) style.backgroundColor = props.backgroundColor;
  if (props.borderRadius !== undefined) style.borderRadius = props.borderRadius;
  if (props.borderWidth !== undefined) style.borderWidth = props.borderWidth;
  if (props.borderColor !== undefined) style.borderColor = props.borderColor;
  if (props.width !== undefined) style.width = props.width as any;
  if (props.height !== undefined) style.height = props.height as any;
  if (props.minWidth !== undefined) style.minWidth = props.minWidth as any;
  if (props.minHeight !== undefined) style.minHeight = props.minHeight as any;
  if (props.maxWidth !== undefined) style.maxWidth = props.maxWidth as any;
  if (props.maxHeight !== undefined) style.maxHeight = props.maxHeight as any;
  if (props.position !== undefined) style.position = props.position;
  if (props.top !== undefined) style.top = props.top;
  if (props.bottom !== undefined) style.bottom = props.bottom;
  if (props.left !== undefined) style.left = props.left;
  if (props.right !== undefined) style.right = props.right;
  if (props.overflow !== undefined) style.overflow = props.overflow;
  if (props.opacity !== undefined) style.opacity = props.opacity;
  if (props.zIndex !== undefined) style.zIndex = props.zIndex;
  
  return style;
}

// YStack - Vertical stack (column)
export function YStack({ 
  children, 
  style, 
  onPress,
  ...props 
}: StackProps) {
  const computedStyle = buildViewStyle(props);
  const finalStyle = [{ flexDirection: 'column' as const }, computedStyle, style];
  
  if (onPress) {
    return (
      <Pressable style={finalStyle} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  
  return <View style={finalStyle}>{children}</View>;
}

// XStack - Horizontal stack (row)
export function XStack({ 
  children, 
  style, 
  onPress,
  ...props 
}: StackProps) {
  const computedStyle = buildViewStyle(props);
  const finalStyle = [{ flexDirection: 'row' as const, alignItems: 'center' as const }, computedStyle, style];
  
  if (onPress) {
    return (
      <Pressable style={finalStyle} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  
  return <View style={finalStyle}>{children}</View>;
}

// Text component with Tamagui-like props
interface TextProps extends CommonStyleProps {
  children?: React.ReactNode;
  style?: TextStyle;
  fontSize?: number | string;
  fontWeight?: TextStyle['fontWeight'];
  color?: string;
  textAlign?: TextStyle['textAlign'];
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
}

export function Text({ 
  children, 
  style, 
  fontSize,
  fontWeight,
  color,
  textAlign,
  numberOfLines,
  ellipsizeMode,
  ...props 
}: TextProps) {
  const textStyle: TextStyle = {
    ...buildViewStyle(props) as any,
  };
  
  if (fontSize !== undefined) {
    textStyle.fontSize = parseValue(fontSize) || 14;
  }
  if (fontWeight !== undefined) textStyle.fontWeight = fontWeight;
  if (color !== undefined) textStyle.color = color;
  if (textAlign !== undefined) textStyle.textAlign = textAlign;
  
  return (
    <RNText 
      style={[textStyle, style]} 
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {children}
    </RNText>
  );
}

// Heading component
interface HeadingProps extends TextProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const headingSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 30,
  '2xl': 36,
};

export function Heading({ 
  children, 
  size = 'md',
  style,
  ...props 
}: HeadingProps) {
  return (
    <Text 
      fontSize={headingSizes[size]} 
      fontWeight="700"
      color="#0f172a"
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
}

// Paragraph component
export function Paragraph({ 
  children, 
  style,
  ...props 
}: TextProps) {
  return (
    <Text 
      fontSize={14} 
      color="#64748b"
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
}

// ScrollView wrapper
interface ScrollViewProps extends CommonStyleProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
}

export function ScrollView({ 
  children, 
  style, 
  contentContainerStyle,
  horizontal,
  showsVerticalScrollIndicator = false,
  showsHorizontalScrollIndicator = false,
  ...props 
}: ScrollViewProps) {
  const computedStyle = buildViewStyle(props);
  
  return (
    <RNScrollView 
      style={[computedStyle, style]}
      contentContainerStyle={contentContainerStyle}
      horizontal={horizontal}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
    >
      {children}
    </RNScrollView>
  );
}

// Image wrapper
interface ImageProps extends CommonStyleProps {
  source: { uri: string } | number;
  style?: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function Image({ 
  source, 
  style, 
  resizeMode = 'cover',
  ...props 
}: ImageProps) {
  const computedStyle = buildViewStyle(props);
  
  return (
    <RNImage 
      source={source}
      style={[computedStyle as any, style]}
      resizeMode={resizeMode}
    />
  );
}

// Spinner component
interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}

export function Spinner({ size = 'small', color = '#7c3aed' }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} />;
}

// Separator component
interface SeparatorProps {
  vertical?: boolean;
  style?: ViewStyle;
}

export function Separator({ vertical = false, style }: SeparatorProps) {
  return (
    <View 
      style={[
        {
          backgroundColor: '#e2e8f0',
          ...(vertical 
            ? { width: 1, alignSelf: 'stretch' } 
            : { height: 1, width: '100%' }
          ),
        },
        style,
      ]} 
    />
  );
}

// Theme colors for reference
export const colors = {
  primary: '#7c3aed',
  primaryHover: '#6d28d9',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
};

// Export everything
export { View } from 'react-native';
