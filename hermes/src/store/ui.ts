import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'auto';

  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  theme: 'auto',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
