import { styled, Avatar as TamaguiAvatar, Text, GetProps } from 'tamagui';
import { Image } from 'expo-image';

// Avatar container
export const Avatar = styled(TamaguiAvatar, {
  name: 'Avatar',
  borderRadius: 9999,
  overflow: 'hidden',
  backgroundColor: '$muted',
  alignItems: 'center',
  justifyContent: 'center',

  variants: {
    size: {
      xs: {
        width: 24,
        height: 24,
      },
      sm: {
        width: 32,
        height: 32,
      },
      md: {
        width: 40,
        height: 40,
      },
      lg: {
        width: 56,
        height: 56,
      },
      xl: {
        width: 80,
        height: 80,
      },
      '2xl': {
        width: 120,
        height: 120,
      },
    },
    bordered: {
      true: {
        borderWidth: 2,
        borderColor: '$borderColor',
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Avatar Image
export const AvatarImage = styled(TamaguiAvatar.Image, {
  name: 'AvatarImage',
  width: '100%',
  height: '100%',
});

// Avatar Fallback (initials)
export const AvatarFallback = styled(TamaguiAvatar.Fallback, {
  name: 'AvatarFallback',
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '$primary',
});

const FallbackText = styled(Text, {
  name: 'AvatarFallbackText',
  color: 'white',
  fontWeight: '600',
  textTransform: 'uppercase',

  variants: {
    size: {
      xs: { fontSize: 10 },
      sm: { fontSize: 12 },
      md: { fontSize: 14 },
      lg: { fontSize: 18 },
      xl: { fontSize: 24 },
      '2xl': { fontSize: 36 },
    },
  } as const,
});

// Helper to get initials from name
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Complete Avatar component
interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  bordered?: boolean;
}

export function UserAvatar({ src, name = '', size = 'md', bordered }: UserAvatarProps) {
  const initials = getInitials(name);

  return (
    <Avatar size={size} bordered={bordered}>
      {src ? (
        <AvatarImage source={{ uri: src }} />
      ) : (
        <AvatarFallback delayMs={0}>
          <FallbackText size={size}>{initials}</FallbackText>
        </AvatarFallback>
      )}
    </Avatar>
  );
}

export type AvatarProps = GetProps<typeof Avatar>;

export default Avatar;
