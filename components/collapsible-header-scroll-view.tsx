import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { StyleSheet, View, type RefreshControlProps } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

/** Below safe area: top pad + large title + gap + subtitle + bottom pad */
const HEADER_BODY_EXPANDED = 8 + 34 + 4 + 16 + 12;
/** Visible strip below safe area when fully collapsed (fits ~17pt title + padding) */
const HEADER_BODY_COLLAPSED = 50;
/** Tight gap so the hero reads as part of the greeting block */
const DECORATION_MARGIN_TOP = 6;
/** Matches trainer home hero card; clips shell bg in rounded corners when title overlays */
const HEADER_DECORATION_BORDER_RADIUS = 20;
const HEADER_DECORATION_RADIUS_COLLAPSED = 12;
/** Min hero height when title overlays and header is collapsed (17pt line + breathing room) */
const OVERLAY_HERO_MIN_HEIGHT = 42;
/** Hero `marginTop` at end of scroll (must match `decorationAnimatedStyle` floor) */
const DECORATION_MARGIN_TOP_COLLAPSED = 2;
/**
 * Extra px so the shell does not clip the hero’s bottom `borderWidth` / radius (avoids a “sliced” flat edge).
 */
const HERO_BOTTOM_CLIP_BUFFER = 2;
/** Large-title line height used in `HEADER_BODY_EXPANDED`; subtract when title is drawn inside the hero. */
const HEADER_TITLE_EXPANDED_LINE = 34;
/** Subtitle row in `HEADER_BODY_EXPANDED` (line + bottom pad) reclaimed when subtitle is drawn inside the hero. */
const HEADER_SUBTITLE_BODY_RECLAIM = 16 + 12;
/** Extra hero height when subtitle sits inside the decoration (two lines + gap under title). */
const OVERLAY_SUBTITLE_EXTRA_DECORATION_HEIGHT = 48;

export type CollapsibleHeaderScrollViewProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** @default Activity-style large title */
  testID?: string;
  /** Tailwind classes for ScrollView `contentContainerStyle` complement via inner wrapper */
  contentContainerClassName?: string;
  showsVerticalScrollIndicator?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Add to expanded header body height when subtitle wraps to 2+ lines (avoids clipping). */
  expandedExtraHeight?: number;
  /**
   * When true, do not add `insets.top` to header heights — use when a parent `SafeAreaView`
   * already applies the top edge (avoids zero-inset bugs and double padding).
   */
  omitInternalTopInset?: boolean;
  /** Optional hero (e.g. purple card); clipped as the shell shrinks. */
  headerDecoration?: ReactNode;
  /** Expanded height of `headerDecoration` (default 100). */
  headerDecorationHeight?: number;
  /**
   * Gap between header padding and the hero decoration (default 6).
   * Use 0 on screens where fixed top FABs should sit fully inside the gradient card.
   */
  decorationMarginTop?: number;
  /**
   * When true with `headerDecoration`, draws the title on top of the hero (inside the same vertical slot)
   * so the greeting sits on the card instead of on the shell background.
   */
  overlayTitleOnHeaderDecoration?: boolean;
}>;

/**
 * Large title that collapses on scroll: the header shell height interpolates from expanded →
 * collapsed (clips from the bottom so title stays visible), with a matching animated top spacer
 * inside the ScrollView so content doesn’t jump. With `overlayTitleOnHeaderDecoration`, the title is
 * painted on the hero; otherwise the title stacks above the hero, then the subtitle.
 *
 * @see https://medium.com/appandflow/react-native-scrollview-animated-header-10a18cb9469e
 * @see https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/
 */
export function CollapsibleHeaderScrollView({
  title,
  subtitle,
  children,
  testID,
  contentContainerClassName,
  showsVerticalScrollIndicator = false,
  refreshControl,
  expandedExtraHeight = 0,
  omitInternalTopInset = false,
  headerDecoration,
  headerDecorationHeight = 100,
  decorationMarginTop = DECORATION_MARGIN_TOP,
  overlayTitleOnHeaderDecoration = false,
}: CollapsibleHeaderScrollViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const hasHeaderDecoration = Boolean(headerDecoration);
  const overlayTitleOnHero =
    Boolean(headerDecoration) && overlayTitleOnHeaderDecoration;
  const overlaySubtitleInHero = overlayTitleOnHero && Boolean(subtitle);
  const effectiveDecorationExpandedHeight = overlaySubtitleInHero
    ? headerDecorationHeight + OVERLAY_SUBTITLE_EXTRA_DECORATION_HEIGHT
    : headerDecorationHeight;
  const decorationBlock = hasHeaderDecoration
    ? decorationMarginTop + effectiveDecorationExpandedHeight
    : 0;

  const topInset = omitInternalTopInset ? 0 : insets.top;
  const headerPaddingTop = omitInternalTopInset ? 8 : insets.top + 8;
  /** +8 when decoration sits above subtitle: `marginBottom` on the hero wrapper */
  const decorationSubtitleGap =
    hasHeaderDecoration && subtitle && !overlaySubtitleInHero ? 8 : 0;
  const expandedHeight =
    topInset +
    HEADER_BODY_EXPANDED +
    expandedExtraHeight +
    decorationBlock +
    decorationSubtitleGap -
    (overlayTitleOnHero ? HEADER_TITLE_EXPANDED_LINE : 0) -
    (overlaySubtitleInHero ? HEADER_SUBTITLE_BODY_RECLAIM : 0);
  /**
   * When the title sits on the hero, the collapsed shell must be tall enough to show the full
   * compressed card (padding + margin + min height + border), or `overflow: hidden` on the shell
   * cuts off the bottom radius and border.
   */
  const overlayCollapsedBodyMin =
    headerPaddingTop -
    topInset +
    DECORATION_MARGIN_TOP_COLLAPSED +
    OVERLAY_HERO_MIN_HEIGHT +
    HERO_BOTTOM_CLIP_BUFFER;
  const collapsedBody = overlayTitleOnHero
    ? Math.max(HEADER_BODY_COLLAPSED, overlayCollapsedBodyMin)
    : HEADER_BODY_COLLAPSED;
  const collapsedHeight = topInset + collapsedBody;
  const scrollRange = Math.max(1, expandedHeight - collapsedHeight);
  const minDecorationHeight = overlayTitleOnHero ? OVERLAY_HERO_MIN_HEIGHT : 0;
  const hasDecoration = hasHeaderDecoration;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  /** Shell + scroll spacer shrink together so the full expanded header (incl. decoration) is visible at rest. */
  const headerShellHeightStyle = useAnimatedStyle(
    () => ({
      height: interpolate(
        scrollY.value,
        [0, scrollRange],
        [expandedHeight, collapsedHeight],
        Extrapolation.CLAMP,
      ),
    }),
    [scrollRange, expandedHeight, collapsedHeight],
  );

  const scrollTopSpacerStyle = useAnimatedStyle(
    () => ({
      height: interpolate(
        scrollY.value,
        [0, scrollRange],
        [expandedHeight, collapsedHeight],
        Extrapolation.CLAMP,
      ),
    }),
    [scrollRange, expandedHeight, collapsedHeight],
  );

  const titleStyle = useAnimatedStyle(
    () => ({
      fontSize: interpolate(scrollY.value, [0, scrollRange], [28, 17], Extrapolation.CLAMP),
      lineHeight: interpolate(scrollY.value, [0, scrollRange], [34, 22], Extrapolation.CLAMP),
      color: colors.foreground,
      backgroundColor: "transparent",
      fontWeight: "700" as const,
    }),
    [colors.foreground, scrollRange],
  );

  const subtitleStyle = useAnimatedStyle(
    () => ({
      fontSize: 14,
      lineHeight: 18,
      marginTop: 4,
      color: colors.muted,
      backgroundColor: "transparent",
      opacity: interpolate(scrollY.value, [0, scrollRange * 0.55], [1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(scrollY.value, [0, scrollRange], [0, -6], Extrapolation.CLAMP),
        },
      ],
    }),
    [colors.muted, scrollRange],
  );

  const headerChromeStyle = useAnimatedStyle(
    () => ({
      borderBottomWidth: interpolate(
        scrollY.value,
        [scrollRange * 0.35, scrollRange],
        [0, StyleSheet.hairlineWidth],
        Extrapolation.CLAMP,
      ),
      borderBottomColor: colors.border,
    }),
    [colors.border, scrollRange],
  );

  /** Hero scales with scroll (height + corner radius); layout height shrinks so subtitle follows. */
  const decorationAnimatedStyle = useAnimatedStyle(() => {
    if (!hasDecoration) {
      return {};
    }
    const h = interpolate(
      scrollY.value,
      [0, scrollRange],
      [effectiveDecorationExpandedHeight, minDecorationHeight],
      Extrapolation.CLAMP,
    );
    const mt = interpolate(
      scrollY.value,
      [0, scrollRange],
      [decorationMarginTop, DECORATION_MARGIN_TOP_COLLAPSED],
      Extrapolation.CLAMP,
    );
    const r = interpolate(
      scrollY.value,
      [0, scrollRange],
      [HEADER_DECORATION_BORDER_RADIUS, HEADER_DECORATION_RADIUS_COLLAPSED],
      Extrapolation.CLAMP,
    );
    return {
      height: h,
      marginTop: mt,
      borderRadius: r,
    };
  }, [
    hasDecoration,
    scrollRange,
    effectiveDecorationExpandedHeight,
    minDecorationHeight,
    decorationMarginTop,
  ]);

  /** Overlaid title: top-weighted when expanded, vertically centered in the shrinking hero when collapsed. */
  const overlayTitlePositionStyle = useAnimatedStyle(() => {
    const h = interpolate(
      scrollY.value,
      [0, scrollRange],
      [effectiveDecorationExpandedHeight, minDecorationHeight],
      Extrapolation.CLAMP,
    );
    const lh = interpolate(scrollY.value, [0, scrollRange], [34, 22], Extrapolation.CLAMP);
    const centeredTop = (h - lh) / 2;
    const topWeighted = 14;
    const collapseT = interpolate(scrollY.value, [0, scrollRange], [0, 1], Extrapolation.CLAMP);
    const top = topWeighted * (1 - collapseT) + centeredTop * collapseT;
    return {
      top,
      left: 16,
      right: 16,
    };
  }, [scrollRange, effectiveDecorationExpandedHeight, minDecorationHeight]);

  /** Subtitle inside hero: fades/shrinks away as the header collapses. */
  const overlaySubtitleStyle = useAnimatedStyle(() => {
    if (!overlaySubtitleInHero) {
      return { opacity: 0 };
    }
    const h = interpolate(
      scrollY.value,
      [0, scrollRange],
      [effectiveDecorationExpandedHeight, minDecorationHeight],
      Extrapolation.CLAMP,
    );
    const lh = interpolate(scrollY.value, [0, scrollRange], [34, 22], Extrapolation.CLAMP);
    const centeredTop = (h - lh) / 2;
    const topWeighted = 14;
    const collapseT = interpolate(scrollY.value, [0, scrollRange], [0, 1], Extrapolation.CLAMP);
    const titleTop = topWeighted * (1 - collapseT) + centeredTop * collapseT;
    const subtitleTop = titleTop + lh + 4;
    const fadeEnd = scrollRange * 0.52;
    const opacity = interpolate(
      scrollY.value,
      [0, fadeEnd],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [0, fadeEnd],
      [1, 0.85],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, fadeEnd],
      [0, -6],
      Extrapolation.CLAMP,
    );
    return {
      position: "absolute" as const,
      left: 16,
      right: 16,
      top: subtitleTop,
      opacity,
      transform: [{ translateY }, { scale }],
    };
  }, [
    overlaySubtitleInHero,
    scrollRange,
    effectiveDecorationExpandedHeight,
    minDecorationHeight,
  ]);

  const decorationStaticBase = !decorationBlock
   ? { height: 0, marginTop: 0, overflow: "hidden" as const }
    : {
        marginBottom: subtitle && !overlaySubtitleInHero ? 8 : 0,
        width: "100%" as const,
        alignSelf: "stretch" as const,
        overflow: "hidden" as const,
        position: "relative" as const,
      };

  return (
    <View className="flex-1 bg-background" accessibilityLabel={`${title} screen`}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            overflow: "hidden",
            /** Below root `ProfileFAB` / alerts (zIndex ~1019–1020); above scroll content so collapsed title stays visible. */
            zIndex: 1010,
            elevation: 12,
            backgroundColor: colors.background,
          },
          headerShellHeightStyle,
          headerChromeStyle,
        ]}
      >
        <View
          pointerEvents="box-none"
          style={{
            minHeight: expandedHeight,
            paddingTop: headerPaddingTop,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <View style={{ width: "100%" }} pointerEvents="box-none">
            {overlayTitleOnHero ? (
              headerDecoration ? (
                <Animated.View
                  style={[decorationStaticBase, decorationAnimatedStyle]}
                  testID={testID ? `${testID}-header-decoration` : undefined}
                >
                  <View
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="box-none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {headerDecoration}
                  </View>
                  <Animated.Text
                    style={[
                      titleStyle,
                      overlayTitlePositionStyle,
                      {
                        position: "absolute",
                        zIndex: 2,
                        backgroundColor: "transparent",
                        padding: 0,
                        margin: 0,
                        textAlign: "left",
                      },
                    ]}
                    accessibilityRole="header"
                    numberOfLines={1}
                    selectable={false}
                    testID={testID ? `${testID}-title` : undefined}
                  >
                    {title}
                  </Animated.Text>
                  {overlaySubtitleInHero && subtitle ? (
                    <Animated.Text
                      pointerEvents="none"
                      className="text-left text-bodySm text-muted z-[2] bg-transparent"
                      style={overlaySubtitleStyle}
                      numberOfLines={2}
                      testID={testID ? `${testID}-subtitle` : undefined}
                    >
                      {subtitle}
                    </Animated.Text>
                  ) : null}
                </Animated.View>
              ) : null
            ) : (
              <>
                <Animated.Text
                  style={titleStyle}
                  accessibilityRole="header"
                  numberOfLines={1}
                  testID={testID ? `${testID}-title` : undefined}
                >
                  {title}
                </Animated.Text>
                {headerDecoration ? (
                  <Animated.View
                    style={[decorationStaticBase, decorationAnimatedStyle]}
                    testID={testID ? `${testID}-header-decoration` : undefined}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {headerDecoration}
                  </Animated.View>
                ) : null}
              </>
            )}
          </View>
          {subtitle && !overlaySubtitleInHero ? (
            <Animated.Text
              style={subtitleStyle}
              numberOfLines={2}
              testID={testID ? `${testID}-subtitle` : undefined}
            >
              {subtitle}
            </Animated.Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.ScrollView
        testID={testID}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        scrollEventThrottle={1}
        onScroll={scrollHandler}
        refreshControl={refreshControl}
        contentContainerStyle={{
          flexGrow: 1,
        }}
      >
        <Animated.View style={scrollTopSpacerStyle} />
        <View className={cn("flex-1", contentContainerClassName)}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}
