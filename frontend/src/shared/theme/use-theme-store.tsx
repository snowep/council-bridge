// Single source of truth for theme state
// Replaces dual state in App.tsx and Layout.tsx

import React from 'react';
import { createContext, useContext, useCallback, type ReactNode, useState, useEffect } from 'react';
import { lightTheme, darkTheme } from './index';
import { type Theme } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: Theme;
}

// Singleton pattern for shared theme state
let themeState: {
  mode: ThemeMode;
  listeners: Set<() => void>;
} | null = null;

function getThemeState() {
  if (!themeState) {
    themeState = {
      mode: 'light',
      listeners: new Set(),
    };
    // Initialize from localStorage if available
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('theme_mode') as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        themeState.mode = saved;
      } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        themeState.mode = 'dark';
      }
    }
  }
  return themeState;
}

// Theme context for components that need theme state
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeStore() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeStore must be used within a ThemeProvider');
  }
  return context;
}

// ThemeProvider component that wraps the app with theme context and persistence
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const state = getThemeState();
    const listener = () => forceUpdate(n => n + 1);
    // Subscribe to changes
    state.listeners.add(listener);

    // Cleanup on unmount
    return () => {
      state.listeners.delete(listener);
    };
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    const state = getThemeState();
    state.mode = mode;
    try {
      localStorage.setItem('theme_mode', mode);
    } catch {}
    // Notify all listeners
    state.listeners.forEach(listener => listener());
  }, []);

  const value: ThemeContextValue = {
    mode: getThemeState().mode,
    setMode,
    theme: getThemeState().mode === 'dark' ? darkTheme : lightTheme,
  };

  return (
    <React.Fragment>
      <ThemeContext.Provider value={value}>
        {children}
      </ThemeContext.Provider>
    </React.Fragment>
  );
}