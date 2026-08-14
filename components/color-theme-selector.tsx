'use client';

import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

const THEMES = [
  { value: 'forest', label: 'Forest' },
  { value: 'sage', label: 'Sage' },
  { value: 'warm', label: 'Deep' },
] as const;

type ColorTheme = (typeof THEMES)[number]['value'];

function isColorTheme(value: string | null): value is ColorTheme {
  return THEMES.some((theme) => theme.value === value);
}

export function ColorThemeSelector() {
  const [theme, setTheme] = useState<ColorTheme>('forest');

  useEffect(() => {
    const saved = window.localStorage.getItem('recipe-reborn-color-theme');
    const initial = isColorTheme(saved) ? saved : 'forest';
    setTheme(initial);
    document.documentElement.dataset.colorTheme = initial;
  }, []);

  const selectTheme = (nextTheme: ColorTheme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.colorTheme = nextTheme;
    window.localStorage.setItem('recipe-reborn-color-theme', nextTheme);
  };

  return (
    <label className="flex min-h-10 items-center gap-1 rounded-full border border-white/40 bg-black/20 px-2 text-white shadow-sm backdrop-blur">
      <Palette className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(event) => selectTheme(event.target.value as ColorTheme)}
        className="max-w-20 cursor-pointer bg-transparent py-2 text-xs font-semibold text-white outline-none sm:max-w-none"
      >
        {THEMES.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-950">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
