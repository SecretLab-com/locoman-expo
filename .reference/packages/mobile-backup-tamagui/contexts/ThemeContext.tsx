import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@locomotivate_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load theme from storage on mount
  useEffect(() => {
    loadTheme();
  }, []);
  
  // Save theme to storage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveTheme();
    }
  }, [theme, isLoaded]);
  
  const loadTheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored && ['light', 'dark', 'system'].includes(stored)) {
        setThemeState(stored as Theme);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setIsLoaded(true);
    }
  };
  
  const saveTheme = async () => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };
  
  const resolvedTheme: 'light' | 'dark' = 
    theme === 'system' 
      ? (systemColorScheme || 'light') 
      : theme;
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  
  const toggleTheme = () => {
    setThemeState(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'light';
      // If system, toggle to opposite of current resolved theme
      return resolvedTheme === 'light' ? 'dark' : 'light';
    });
  };
  
  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
