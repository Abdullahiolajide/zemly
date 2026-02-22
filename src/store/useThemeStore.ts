import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: ThemeChoice;
    setTheme: (theme: ThemeChoice) => void;
}

/**
 * Resolve the effective theme (light or dark) by checking the
 * system preference when the user has selected 'system'.
 */
function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
    if (choice === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }
    return choice;
}

/**
 * Apply the resolved theme to the <html> element so all CSS can
 * key off `html.dark` / `html.light`.
 */
function applyThemeToDOM(choice: ThemeChoice) {
    const resolved = resolvedTheme(choice);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark',
            setTheme: (theme) => {
                applyThemeToDOM(theme);
                set({ theme });
            },
        }),
        {
            name: 'zemly-theme',
            onRehydrateStorage: () => (state) => {
                // Apply persisted theme when the store rehydrates
                if (state) applyThemeToDOM(state.theme);
            },
        }
    )
);

// ── Listen for system preference changes when "system" is selected ──
if (typeof window !== 'undefined') {
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
            const current = useThemeStore.getState().theme;
            if (current === 'system') {
                applyThemeToDOM('system');
            }
        });
}
