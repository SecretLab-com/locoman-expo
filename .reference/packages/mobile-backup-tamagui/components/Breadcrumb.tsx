import React from 'react';
import { XStack, Text, styled } from 'tamagui';
import { ChevronRight, Home } from '@tamagui/lucide-icons';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

const BreadcrumbLink = styled(Text, {
  name: 'BreadcrumbLink',
  fontSize: '$3',
  color: '$blue10',
  
  hoverStyle: {
    textDecorationLine: 'underline',
  },
});

const BreadcrumbText = styled(Text, {
  name: 'BreadcrumbText',
  fontSize: '$3',
  color: '$gray11',
});

export function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const router = useRouter();
  
  const allItems: BreadcrumbItem[] = showHome 
    ? [{ label: 'Home', href: '/' }, ...items]
    : items;
  
  return (
    <XStack alignItems="center" gap="$2" flexWrap="wrap">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const isHome = index === 0 && showHome;
        
        return (
          <XStack key={index} alignItems="center" gap="$2">
            {item.href && !isLast ? (
              <Pressable onPress={() => router.push(item.href as any)}>
                <XStack alignItems="center" gap="$1">
                  {isHome && <Home size={14} color="$blue10" />}
                  <BreadcrumbLink>{item.label}</BreadcrumbLink>
                </XStack>
              </Pressable>
            ) : (
              <XStack alignItems="center" gap="$1">
                {isHome && <Home size={14} color="$gray11" />}
                <BreadcrumbText>{item.label}</BreadcrumbText>
              </XStack>
            )}
            {!isLast && (
              <ChevronRight size={14} color="$gray8" />
            )}
          </XStack>
        );
      })}
    </XStack>
  );
}

export default Breadcrumb;
