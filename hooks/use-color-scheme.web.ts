/**
 * Web color scheme hook.
 *
 * Uses the app's ThemeProvider context (same as native) so that inline styles
 * via useColors() respect the user's in-app theme setting — not just the
 * browser's prefers-color-scheme media query.
 */
import { useThemeContext } from "@/lib/theme-provider";

export function useColorScheme() {
  return useThemeContext().colorScheme;
}
