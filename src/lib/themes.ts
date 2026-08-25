/**
 * Цветови теми. Всяка тема просто презаписва CSS променливите, а целият
 * интерфейс ги ползва — затова смяната е мигновена и не иска презареждане.
 */

export type ThemeId = 'midnight' | 'charcoal' | 'warm' | 'light';

export interface Theme {
  id: ThemeId;
  name: string;
  /** Цвят на системната лента в standalone режим на iPhone. */
  themeColor: string;
  dark: boolean;
  /** Три цвята за кръгчето в настройките. */
  swatch: [string, string, string];
}

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Полунощ',
    themeColor: '#0B0F14',
    dark: true,
    swatch: ['#0B0F14', '#18202c', '#00C853'],
  },
  {
    id: 'charcoal',
    name: 'Въглен',
    themeColor: '#0D0D0F',
    dark: true,
    swatch: ['#0D0D0F', '#1E1E24', '#00C853'],
  },
  {
    id: 'warm',
    name: 'Топла',
    themeColor: '#14100C',
    dark: true,
    swatch: ['#14100C', '#29211A', '#00C853'],
  },
  {
    id: 'light',
    name: 'Светла',
    themeColor: '#F6F7F9',
    dark: false,
    swatch: ['#F6F7F9', '#DFE4EA', '#00A344'],
  },
];

export const DEFAULT_THEME: ThemeId = 'midnight';

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}

/**
 * Слага темата върху документа и обновява цвета на системната лента.
 */
export function applyTheme(id: ThemeId): void {
  const theme = themeById(id);

  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.themeColor);
}
