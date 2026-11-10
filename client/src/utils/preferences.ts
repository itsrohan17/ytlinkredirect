import { DashboardView, UserPreferences } from '../types';

export const PREFERENCES_STORAGE_KEY = 'linktwin_user_preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  defaultView: 'overview',
  defaultQrSize: 512,
  defaultQrEc: 'M',
  compactTables: false,
};

const VALID_VIEWS: Set<DashboardView> = new Set([
  'overview',
  'links',
  'analytics',
  'media',
  'utilities',
  'settings',
]);

export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      theme: parsed?.theme === 'light' ? 'light' : 'dark',
      defaultView: VALID_VIEWS.has(parsed?.defaultView) ? parsed.defaultView : 'overview',
      defaultQrSize: [256, 384, 512, 768, 1024].includes(Number(parsed?.defaultQrSize))
        ? (Number(parsed.defaultQrSize) as UserPreferences['defaultQrSize'])
        : 512,
      defaultQrEc: ['L', 'M', 'Q', 'H'].includes(parsed?.defaultQrEc) ? parsed.defaultQrEc : 'M',
      compactTables: Boolean(parsed?.compactTables),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveUserPreferences(prefs: UserPreferences): UserPreferences {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }
  applyThemeToDocument(prefs.theme);
  return prefs;
}

export function resetUserPreferences(): UserPreferences {
  return saveUserPreferences({ ...DEFAULT_PREFERENCES });
}

export function applyThemeToDocument(theme: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}
