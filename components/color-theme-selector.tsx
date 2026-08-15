'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

/**
 * Display mode picker.
 *
 * Previously three shades of green, which looked like a choice but changed
 * nothing that mattered. Each option now targets a specific vision need — see
 * the display-mode block in globals.css for what each one actually changes.
 *
 * Labels describe the effect rather than a colour name, so someone who needs
 * one can find it without guessing what "Sage" does for them.
 */
const THEMES = [
  {
    value: 'default',
    label: 'Default',
    hint: 'Standard Recipe Reborn green',
  },
  {
    value: 'high-contrast',
    label: 'High contrast',
    hint: 'Darker background, brighter text and visible focus outlines',
  },
  {
    value: 'colorblind',
    label: 'Colorblind friendly',
    hint: 'Flagged additives shown in amber instead of red, so they stay distinct from the green fresh-ingredient markers',
  },
] as const;

type ColorTheme = (typeof THEMES)[number]['value'];

// 'forest' | 'sage' | 'warm' were the previous values; anyone carrying one in
// localStorage lands on 'default' rather than an unstyled page.
const LEGACY_THEMES: Record<string, ColorTheme> = {
  forest: 'default',
  sage: 'default',
  warm: 'default',
};

function resolveTheme(value: string | null): ColorTheme {
  if (!value) return 'default';
  if (THEMES.some((theme) => theme.value === value)) return value as ColorTheme;
  return LEGACY_THEMES[value] ?? 'default';
}

export function ColorThemeSelector() {
  const [theme, setTheme] = useState<ColorTheme>('default');

  useEffect(() => {
    const saved = window.localStorage.getItem('recipe-reborn-color-theme');
    const initial = resolveTheme(saved);
    setTheme(initial);
    document.documentElement.dataset.colorTheme = initial;
    // Rewrite a legacy value so the migration only happens once.
    if (saved !== initial) {
      window.localStorage.setItem('recipe-reborn-color-theme', initial);
    }
  }, []);

  const selectTheme = (nextTheme: ColorTheme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.colorTheme = nextTheme;
    window.localStorage.setItem('recipe-reborn-color-theme', nextTheme);
  };

  const active = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <label className="flex min-h-10 items-center gap-1 rounded-full border border-white/40 bg-black/20 px-2 text-white shadow-sm backdrop-blur">
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Display mode</span>
      <select
        aria-label="Display mode"
        aria-describedby="display-mode-hint"
        value={theme}
        onChange={(event) => selectTheme(event.target.value as ColorTheme)}
        className="max-w-28 cursor-pointer bg-transparent py-2 text-xs font-semibold text-white outline-none sm:max-w-none"
      >
        {THEMES.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-950">
            {option.label}
          </option>
        ))}
      </select>
      {/* Announced with the control so the effect is available to screen
          readers, without adding visible chrome to the header. */}
      <span id="display-mode-hint" className="sr-only">
        {active.hint}
      </span>
    </label>
  );
}
