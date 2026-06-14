import { create } from 'zustand';
import { useLayoutStore } from './layoutStore';

/** A crawled page surfaced in the right panel (clicked from a fetch_url card). */
export interface PageView {
  url: string;
  content: string;
  title?: string;
  chars?: number;
  crawler?: string;
}

interface RightPanelState {
  /** Active page viewer target; null = show the default sub-agent panel. */
  page: PageView | null;
  openPage: (page: PageView) => void;
  closePage: () => void;
}

/**
 * Drives the right panel's "page content" viewer (lobe web-browsing style):
 * clicking a fetch_url card opens the full crawled page here and reveals the panel.
 */
export const useRightPanelStore = create<RightPanelState>((set) => ({
  page: null,
  openPage: (page) => {
    set({ page });
    useLayoutStore.getState().setRightPanelOpen(true);
  },
  closePage: () => set({ page: null }),
}));
