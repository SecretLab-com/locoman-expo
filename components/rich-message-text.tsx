import { useMemo } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";

type Segment = {
  text: string;
  isLink: boolean;
  href?: string;
};

type Props = {
  content: string;
  isOwn?: boolean;
  textClassName?: string;
  linkClassName?: string;
  colors: {
    primary: string;
    foreground: string;
    background: string;
    muted: string;
  };
  testIDPrefix?: string;
};

const LINK_REGEX =
  /((?:https?:\/\/|mailto:|tel:|locomotivate:(?:\/\/)?)[^\s<>"'`]+)/gi;

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[),.!?;:]+$/g, "");
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const href = trimTrailingPunctuation(raw);
    const start = match.index;
    const end = start + raw.length;
    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        isLink: false,
      });
    }
    segments.push({
      text: href,
      isLink: true,
      href,
    });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isLink: false,
    });
  }

  return segments;
}

function getDisplayText(href: string): string {
  if (href.startsWith("locomotivate:")) return "Open in LocoMotivate";
  if (href.length <= 48) return href;
  return `${href.slice(0, 45)}...`;
}

export function RichMessageText({
  content,
  isOwn = false,
  textClassName,
  linkClassName,
  colors,
  testIDPrefix = "message-link",
}: Props) {
  const segments = useMemo(() => parseSegments(content || ""), [content]);
  const links = useMemo(
    () => segments.filter((s) => s.isLink && s.href).map((s) => s.href as string),
    [segments],
  );

  const openLink = async (href: string) => {
    try {
      const canOpen = await Linking.canOpenURL(href);
      if (!canOpen) {
        Alert.alert("Cannot open link", "This link is not supported on this device.");
        return;
      }
      await Linking.openURL(href);
    } catch (error: any) {
      Alert.alert("Unable to open link", error?.message || "Please try again.");
    }
  };

  return (
    <View>
      <Text className={textClassName}>
        {segments.map((segment, idx) => {
          if (!segment.isLink || !segment.href) {
            return <Text key={`${idx}-${segment.text}`}>{segment.text}</Text>;
          }
          const isLocoLink = segment.href.startsWith("locomotivate:");
          return (
            <Text
              key={`${idx}-${segment.href}`}
              className={linkClassName}
              style={{
                textDecorationLine: "underline",
                fontWeight: "600",
                color: isLocoLink ? "#38BDF8" : isOwn ? colors.background : colors.primary,
              }}
              onPress={() => void openLink(segment.href!)}
              accessibilityRole="link"
              accessibilityLabel={`Open link ${segment.href}`}
              testID={`${testIDPrefix}-inline-${idx}`}
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>

      {links.length ? (
        <View className="flex-row flex-wrap mt-2">
          {Array.from(new Set(links)).map((href, idx) => (
            <TouchableOpacity
              key={`${href}-${idx}`}
              className="px-2.5 py-1 rounded-full mr-2 mb-2 border"
              style={{
                borderColor: isOwn ? "rgba(255,255,255,0.55)" : colors.primary,
                backgroundColor: isOwn ? "rgba(255,255,255,0.16)" : "rgba(59,130,246,0.12)",
              }}
              onPress={() => void openLink(href)}
              accessibilityRole="button"
              accessibilityLabel={`Open link ${href}`}
              testID={`${testIDPrefix}-chip-${idx}`}
            >
              <Text
                className={isOwn ? "text-white text-xs font-semibold" : "text-primary text-xs font-semibold"}
                numberOfLines={1}
              >
                {getDisplayText(href)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
