import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Appearance = 'light' | 'dark';

interface ThemeState {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  toggleAppearance: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      appearance: 'dark',
      setAppearance: (appearance) => set({ appearance }),
      toggleAppearance: () =>
        set((state) => ({ appearance: state.appearance === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'pi-theme',
      partialize: (state) => ({ appearance: state.appearance }),
    },
  ),
);
