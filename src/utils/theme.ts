export type AppThemeId = 'system' | 'light' | 'warm' | 'dark' | 'midnight';

export interface ThemeOption {
  id: AppThemeId;
  label: string;
  shortLabel: string;
  description: string;
  appearance: 'system' | 'light' | 'dark';
  swatchCanvas: string;
  swatchPanel: string;
  swatchBorder: string;
  swatchAccent: string;
  metaThemeColor: string;
}

export const THEME_STORAGE_KEY = 'megadrum_studio_theme_v2';
export const LEGACY_THEME_STORAGE_KEY = 'megadrum_studio_theme_v1';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light (Daylight)',
    shortLabel: 'Light',
    description: 'Crisp slate canvas and bright white panels for studio daylight.',
    appearance: 'light',
    swatchCanvas: '#f8fafc',
    swatchPanel: '#ffffff',
    swatchBorder: '#cbd5e1',
    swatchAccent: '#2563eb',
    metaThemeColor: '#f8fafc',
  },
  {
    id: 'warm',
    label: 'Warm Light',
    shortLabel: 'Warm',
    description: 'Soft stone surfaces with reduced glare for long editing sessions.',
    appearance: 'light',
    swatchCanvas: '#f4f1ea',
    swatchPanel: '#fcfaf5',
    swatchBorder: '#d6cebd',
    swatchAccent: '#2563eb',
    metaThemeColor: '#f4f1ea',
  },
  {
    id: 'dark',
    label: 'Dark (Studio)',
    shortLabel: 'Dark',
    description: 'Balanced deep slate console optimized for low-light rooms.',
    appearance: 'dark',
    swatchCanvas: '#0b0e14',
    swatchPanel: '#111620',
    swatchBorder: '#1e293b',
    swatchAccent: '#3b82f6',
    metaThemeColor: '#0b0e14',
  },
  {
    id: 'midnight',
    label: 'Midnight (OLED)',
    shortLabel: 'Midnight',
    description: 'High-contrast deep black surfaces for dark stage environments.',
    appearance: 'dark',
    swatchCanvas: '#020408',
    swatchPanel: '#0a0e16',
    swatchBorder: '#182132',
    swatchAccent: '#3b82f6',
    metaThemeColor: '#020408',
  },
  {
    id: 'system',
    label: 'System (Auto)',
    shortLabel: 'Auto',
    description: 'Automatically switches between Light and Dark with your OS.',
    appearance: 'system',
    swatchCanvas: '#64748b',
    swatchPanel: '#1e293b',
    swatchBorder: '#475569',
    swatchAccent: '#3b82f6',
    metaThemeColor: '#0b0e14',
  },
];

export function isValidThemeId(value: string | null): value is AppThemeId {
  return (
    value === 'system' ||
    value === 'light' ||
    value === 'warm' ||
    value === 'dark' ||
    value === 'midnight'
  );
}

export function getSavedTheme(): AppThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeId(saved)) return saved;
    const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    // Ignore storage errors
  }
  return 'dark';
}

export function getOsPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveTheme(theme: AppThemeId): Exclude<AppThemeId, 'system'> {
  if (theme === 'system') {
    return getOsPrefersDark() ? 'dark' : 'light';
  }
  return theme;
}

export function applyThemeToDocument(theme: AppThemeId): Exclude<AppThemeId, 'system'> {
  const effective = resolveEffectiveTheme(theme);
  const isDark = effective === 'dark' || effective === 'midnight';
  const root = document.documentElement;

  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');

  root.setAttribute('data-theme', effective);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  const opt = THEME_OPTIONS.find((t) => t.id === effective);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && opt) {
    meta.setAttribute('content', opt.metaThemeColor);
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }

  return effective;
}
