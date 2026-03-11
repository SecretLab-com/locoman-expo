import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

const THEME_STORAGE_KEY = "locomotivate_theme_preference";
type ThemePreference = ColorScheme | "system";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setColorScheme: (scheme: ColorScheme) => void;
  setThemePreference: (preference: ThemePreference) => void;
  isSystemTheme: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  // Default to dark mode to match Bright Express style
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("dark");
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");

  // Load saved theme preference on mount
  useEffect(() => {
    async function loadThemePreference() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
          setThemePreferenceState(saved as ThemePreference);
          if (saved !== "system") {
            setColorSchemeState(saved as ColorScheme);
          }
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      } finally {
        // no-op; theme application continues after hydration
      }
    }
    loadThemePreference();
  }, []);

  // Update color scheme when system scheme changes (if using system preference)
  useEffect(() => {
    if (themePreference === "system") {
      setColorSchemeState(systemScheme);
    }
  }, [systemScheme, themePreference]);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  const setThemePreference = useCallback(async (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
    
    if (preference === "system") {
      setColorSchemeState(systemScheme);
      applyScheme(systemScheme);
    } else {
      setColorSchemeState(preference);
      applyScheme(preference);
    }
  }, [applyScheme, systemScheme]);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars(
        Object.fromEntries(
          Object.entries(SchemeColors[colorScheme]).map(([token, value]) => [
            `color-${token}`,
            value,
          ]),
        ),
      ),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themePreference,
      setColorScheme,
      setThemePreference,
      isSystemTheme: themePreference === "system",
    }),
    [colorScheme, themePreference, setColorScheme, setThemePreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
