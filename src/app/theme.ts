import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Effective theme: explicit data-theme if set, else the OS preference. */
export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* storage unavailable */
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setT] = useState<Theme>(currentTheme);
  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setT(next);
  }, []);
  return [theme, toggle];
}
