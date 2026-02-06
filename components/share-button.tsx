import { TouchableOpacity, Share, Platform, Alert } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createDeepLink } from "@/hooks/use-deep-link";
import * as Haptics from "expo-haptics";

type ShareableContent = {
  /** Type of content being shared */
  type: "bundle" | "trainer" | "product" | "conversation";
  /** ID of the content */
  id: string;
  /** Title to display in share sheet */
  title: string;
  /** Optional description/message */
  message?: string;
};

/**
 * Generate a shareable deep link URL for the given content.
 */
export function generateShareableLink(content: ShareableContent): string {
  const pathMap: Record<ShareableContent["type"], string> = {
    bundle: `bundle/${content.id}`,
    trainer: `trainer/${content.id}`,
    product: `bundle/${content.id}`, // Products share as bundles
    conversation: `conversation/${content.id}`,
  };

  const path = pathMap[content.type];
  return createDeepLink(path);
}

/**
 * Generate a web-friendly URL for sharing on social media and browsers.
 * This creates a universal link that works on both web and mobile.
 */
export function generateWebShareableLink(content: ShareableContent): string {
  // For web sharing, we use a web URL that can redirect to the app
  // In production, this would be your domain with app association
  const baseUrl = "https://locomotivate.app"; // Replace with actual domain
  
  const pathMap: Record<ShareableContent["type"], string> = {
    bundle: `/bundle/${content.id}`,
    trainer: `/trainer/${content.id}`,
    product: `/bundle/${content.id}`,
    conversation: `/conversation/${content.id}`,
  };

  return `${baseUrl}${pathMap[content.type]}`;
}

type ShareButtonProps = {
  /** Content to share */
  content: ShareableContent;
  /** Size of the icon */
  size?: number;
  /** Custom color for the icon */
  color?: string;
  /** Additional className for the button */
  className?: string;
  /** Callback when share is successful */
  onShareSuccess?: () => void;
  /** Callback when share fails */
  onShareError?: (error: Error) => void;
};

/**
 * A button that opens the native share sheet with a deep link to the content.
 * 
 * Usage:
 * ```tsx
 * <ShareButton
 *   content={{
 *     type: "bundle",
 *     id: "123",
 *     title: "Full Body Transformation",
 *     message: "Check out this amazing fitness program!"
 *   }}
 * />
 * ```
 */
export function ShareButton({
  content,
  size = 22,
  color,
  className = "",
  onShareSuccess,
  onShareError,
}: ShareButtonProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;

  const handleShare = async () => {
    try {
      // Haptic feedback
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Generate the shareable link
      const deepLink = generateShareableLink(content);
      const webLink = generateWebShareableLink(content);

      // Build the share message
      const shareMessage = content.message
        ? `${content.message}\n\n${webLink}`
        : `Check out ${content.title} on LocoMotivate!\n\n${webLink}`;

      // On web, try Web Share API first, then fallback to clipboard
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: content.title, text: shareMessage, url: webLink });
          onShareSuccess?.();
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(shareMessage);
          window.alert("Link copied to clipboard!");
          onShareSuccess?.();
        } else {
          window.prompt("Copy this link:", webLink);
        }
        return;
      }

      // Native share sheet
      const result = await Share.share(
        {
          title: content.title,
          message: shareMessage,
          url: Platform.OS === "ios" ? webLink : undefined,
        },
        {
          dialogTitle: `Share ${content.title}`,
          subject: content.title,
        }
      );

      if (result.action === Share.sharedAction) {
        console.log("[Share] Content shared successfully");
        onShareSuccess?.();
      } else if (result.action === Share.dismissedAction) {
        console.log("[Share] Share dialog dismissed");
      }
    } catch (error) {
      console.error("[Share] Error sharing content:", error);
      onShareError?.(error as Error);
      Alert.alert("Share Failed", "Unable to share this content. Please try again.");
    }
  };

  return (
    <TouchableOpacity
      onPress={handleShare}
      className={`p-2 ${className}`}
      accessibilityLabel={`Share ${content.title}`}
      accessibilityRole="button"
    >
      <IconSymbol name="square.and.arrow.up" size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

/**
 * Hook to share content programmatically.
 * 
 * Usage:
 * ```tsx
 * const { shareContent } = useShare();
 * 
 * const handleShare = () => {
 *   shareContent({
 *     type: "trainer",
 *     id: "456",
 *     title: "Sarah Johnson",
 *     message: "Train with Sarah!"
 *   });
 * };
 * ```
 */
export function useShare() {
  const shareContent = async (content: ShareableContent): Promise<boolean> => {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const webLink = generateWebShareableLink(content);
      const shareMessage = content.message
        ? `${content.message}\n\n${webLink}`
        : `Check out ${content.title} on LocoMotivate!\n\n${webLink}`;

      const result = await Share.share(
        {
          title: content.title,
          message: shareMessage,
          url: Platform.OS === "ios" ? webLink : undefined,
        },
        {
          dialogTitle: `Share ${content.title}`,
          subject: content.title,
        }
      );

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error("[Share] Error sharing content:", error);
      return false;
    }
  };

  return { shareContent, generateShareableLink, generateWebShareableLink };
}
