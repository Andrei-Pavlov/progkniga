import { create } from 'zustand';

const DEMO_LIMITS = {
  entities: 5,
  chapters: 5,
  charsPerChapter: 5000,
} as const;

const STORAGE_KEYS = {
  auth: 'storyweaver_auth',
  demo: 'storyweaver_demo',
  project: 'storyweaver_project',
  book: 'storyweaver_book',
  font: 'storyweaver_font',
  fontSize: 'storyweaver_fontSize',
  theme: 'storyweaver_theme',
  accent: 'storyweaver_accent',
  lineHeight: 'storyweaver_lineHeight',
  textMaxWidth: 'storyweaver_textMaxWidth',
  autoSaveDelay: 'storyweaver_autoSaveDelay',
  focusMode: 'storyweaver_focusMode',
} as const;

export type Theme = 'dark' | 'light' | 'system';
export type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose';

const ACCENT_COLORS: Record<AccentColor, { main: string; hover: string }> = {
  indigo: { main: '#6366f1', hover: '#818cf8' },
  emerald: { main: '#10b981', hover: '#34d399' },
  amber: { main: '#f59e0b', hover: '#fbbf24' },
  rose: { main: '#f43f5e', hover: '#fb7185' },
};

interface AppState {
  isAuthenticated: boolean;
  isDemoUser: boolean;
  currentProject: string | null;
  currentBookId: string | null;
  selectedChapterId: string | null;
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorTextMaxWidth: number;
  autoSaveDelay: number;
  theme: Theme;
  accent: AccentColor;
  focusMode: boolean;
  settingsOpen: boolean;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  viewMode: 'editor' | 'mindmap' | 'timeline';
  searchOpen: boolean;
  setAuthenticated: (value: boolean) => void;
  setDemoUser: (value: boolean) => void;
  setCurrentProject: (path: string | null) => void;
  setCurrentBookId: (id: string | null) => void;
  setSelectedChapterId: (id: string | null) => void;
  setEditorFontFamily: (v: string) => void;
  setEditorFontSize: (v: number) => void;
  setEditorLineHeight: (v: number) => void;
  setEditorTextMaxWidth: (v: number) => void;
  setAutoSaveDelay: (v: number) => void;
  setTheme: (v: Theme) => void;
  setAccent: (v: AccentColor) => void;
  setFocusMode: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  setRightPanelCollapsed: (v: boolean) => void;
  setViewMode: (v: 'editor' | 'mindmap' | 'timeline') => void;
  setSearchOpen: (v: boolean) => void;
}

const load = (key: string, def: string) => localStorage.getItem(key) ?? def;
const loadNum = (key: string, def: number) => Number(localStorage.getItem(key)) || def;

export const useStore = create<AppState>((set) => ({
  isAuthenticated: load(STORAGE_KEYS.auth, '') === 'true',
  isDemoUser: load(STORAGE_KEYS.demo, '') === 'true',
  currentProject: load(STORAGE_KEYS.project, ''),
  currentBookId: load(STORAGE_KEYS.book, ''),
  selectedChapterId: null,
  editorFontFamily: load(STORAGE_KEYS.font, 'Georgia, serif'),
  editorFontSize: loadNum(STORAGE_KEYS.fontSize, 16),
  editorLineHeight: loadNum(STORAGE_KEYS.lineHeight, 1.7),
  editorTextMaxWidth: loadNum(STORAGE_KEYS.textMaxWidth, 0),
  autoSaveDelay: loadNum(STORAGE_KEYS.autoSaveDelay, 800),
  theme: (load(STORAGE_KEYS.theme, 'dark') as Theme) || 'dark',
  accent: (load(STORAGE_KEYS.accent, 'indigo') as AccentColor) || 'indigo',
  focusMode: load(STORAGE_KEYS.focusMode, '') === 'true',
  settingsOpen: false,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  viewMode: 'editor',
  searchOpen: false,
  setAuthenticated: (value) => {
    if (value) localStorage.setItem(STORAGE_KEYS.auth, 'true');
    else localStorage.removeItem(STORAGE_KEYS.auth);
    set({ isAuthenticated: value });
  },
  setDemoUser: (value) => {
    if (value) localStorage.setItem(STORAGE_KEYS.demo, 'true');
    else localStorage.removeItem(STORAGE_KEYS.demo);
    set({ isDemoUser: value });
  },
  setCurrentProject: (path) => {
    if (path) localStorage.setItem(STORAGE_KEYS.project, path);
    else localStorage.removeItem(STORAGE_KEYS.project);
    set({ currentProject: path });
  },
  setCurrentBookId: (id) => {
    if (id) localStorage.setItem(STORAGE_KEYS.book, id);
    else localStorage.removeItem(STORAGE_KEYS.book);
    set({ currentBookId: id });
  },
  setSelectedChapterId: (id) => set({ selectedChapterId: id }),
  setEditorFontFamily: (v) => {
    localStorage.setItem(STORAGE_KEYS.font, v);
    set({ editorFontFamily: v });
  },
  setEditorFontSize: (v) => {
    localStorage.setItem(STORAGE_KEYS.fontSize, String(v));
    set({ editorFontSize: v });
  },
  setEditorLineHeight: (v) => {
    localStorage.setItem(STORAGE_KEYS.lineHeight, String(v));
    set({ editorLineHeight: v });
  },
  setEditorTextMaxWidth: (v) => {
    localStorage.setItem(STORAGE_KEYS.textMaxWidth, String(v));
    set({ editorTextMaxWidth: v });
  },
  setAutoSaveDelay: (v) => {
    localStorage.setItem(STORAGE_KEYS.autoSaveDelay, String(v));
    set({ autoSaveDelay: v });
  },
  setTheme: (v) => {
    localStorage.setItem(STORAGE_KEYS.theme, v);
    set({ theme: v });
    applyTheme(v);
  },
  setAccent: (v) => {
    localStorage.setItem(STORAGE_KEYS.accent, v);
    set({ accent: v });
    applyAccent(v);
  },
  setFocusMode: (v) => {
    localStorage.setItem(STORAGE_KEYS.focusMode, v ? 'true' : '');
    set({ focusMode: v });
  },
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setLeftPanelCollapsed: (v) => set({ leftPanelCollapsed: v }),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
  setViewMode: (v) => set({ viewMode: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
}));

export { DEMO_LIMITS };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  if (isDark) {
    root.style.setProperty('--bg-primary', '#0f0f14');
    root.style.setProperty('--bg-secondary', '#18181f');
    root.style.setProperty('--bg-tertiary', '#22222c');
    root.style.setProperty('--bg-header', '#1a1a24');
    root.style.setProperty('--text-primary', '#e4e4e7');
    root.style.setProperty('--text-secondary', '#a1a1aa');
    root.style.setProperty('--border', '#27272a');
  } else {
    root.style.setProperty('--bg-primary', '#fafafa');
    root.style.setProperty('--bg-secondary', '#f4f4f5');
    root.style.setProperty('--bg-tertiary', '#e4e4e7');
    root.style.setProperty('--bg-header', '#f4f4f5');
    root.style.setProperty('--text-primary', '#18181b');
    root.style.setProperty('--text-secondary', '#71717a');
    root.style.setProperty('--border', '#d4d4d8');
  }
}

function applyAccent(accent: AccentColor) {
  const { main, hover } = ACCENT_COLORS[accent];
  document.documentElement.style.setProperty('--accent', main);
  document.documentElement.style.setProperty('--accent-hover', hover);
}

// Apply on load
applyTheme((localStorage.getItem(STORAGE_KEYS.theme) as Theme) || 'dark');
applyAccent((localStorage.getItem(STORAGE_KEYS.accent) as AccentColor) || 'indigo');

if (localStorage.getItem(STORAGE_KEYS.theme) === 'system') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme('system'));
}
