'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
  resolvedTheme: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark');

  // Read system preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    setSystemTheme(mq.matches ? 'light' : 'dark');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load stored preference
  useEffect(() => {
    const stored = localStorage.getItem('mf-theme') as ThemePreference | null;
    if (stored) setPreferenceState(stored);
  }, []);

  const resolvedTheme: 'light' | 'dark' = preference === 'system' ? systemTheme : preference;

  // Apply to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem('mf-theme', p);
  };

  return (
    <ThemeContext.Provider value={{ preference, setPreference, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
