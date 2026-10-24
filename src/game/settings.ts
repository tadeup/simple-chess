/**
 * pieces: board stays put, all pieces turn to face the player to move (default)
 * rotate: the whole board turns to face the player to move
 * facing: board stays put, Black's pieces always face the far side
 * fixed:  nothing turns
 */
export type Orientation = 'pieces' | 'rotate' | 'facing' | 'fixed';
const ORIENTATIONS: Orientation[] = ['pieces', 'rotate', 'facing', 'fixed'];
export type BoardTheme = 'wood' | 'green' | 'blue' | 'gray';

export interface Settings {
  orientation: Orientation;
  theme: BoardTheme;
  legalMoves: boolean;
  coordinates: boolean;
  autoQueen: boolean;
  showUndo: boolean;
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  orientation: 'pieces',
  theme: 'wood',
  legalMoves: true,
  coordinates: true,
  autoQueen: false,
  showUndo: true,
  sound: true,
  haptics: true,
};

export const THEMES: { id: BoardTheme; name: string; light: string; dark: string }[] = [
  { id: 'wood', name: 'Wood', light: '#f0d9b5', dark: '#b58863' },
  { id: 'green', name: 'Green', light: '#ebecd0', dark: '#739552' },
  { id: 'blue', name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'gray', name: 'Gray', light: '#dcdad6', dark: '#a19d97' },
];

const KEY = 'just-chess.settings.v2';
// v1 defaulted to rotating the board; v2 keeps every other preference but starts on the new default.
const LEGACY_KEY = 'just-chess.settings.v1';

export function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the app keeps working without persistence */
  }
}

export function loadSettings(): Settings {
  let stored = read<Partial<Settings>>(KEY);
  if (!stored) {
    const legacy = read<Partial<Settings>>(LEGACY_KEY);
    stored = legacy ? { ...legacy, orientation: undefined } : {};
  }
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (stored.orientation && ORIENTATIONS.includes(stored.orientation)) s.orientation = stored.orientation;
  if (THEMES.some((t) => t.id === stored.theme)) s.theme = stored.theme as BoardTheme;
  for (const k of ['legalMoves', 'coordinates', 'autoQueen', 'showUndo', 'sound', 'haptics'] as const) {
    if (typeof stored[k] === 'boolean') s[k] = stored[k] as boolean;
  }
  return s;
}

export function saveSettings(s: Settings): void {
  write(KEY, s);
}
