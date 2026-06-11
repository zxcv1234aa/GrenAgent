import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  contextOpen: boolean;
  terminalOpen: boolean;
  theme: 'light' | 'dark' | 'auto';

  toggleSidebar: () => void;
  toggleContext: () => void;
  toggleTerminal: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  contextOpen: false,
  terminalOpen: false,
  theme: 'auto',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleContext: () => set((state) => ({ contextOpen: !state.contextOpen })),
  toggleTerminal: () => set((state) => ({ terminalOpen: !state.terminalOpen })),
  setTheme: (theme) => set({ theme }),
}));
