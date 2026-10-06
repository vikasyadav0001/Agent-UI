import { create } from "zustand";
import { persist } from "zustand/middleware";

type WebSearchState = {
  enabled: boolean;
  toggle: () => void;
};

/** Whether the chat request should bind the web search (MCP) tools. */
export const useWebSearchStore = create<WebSearchState>()(
  persist(
    (set) => ({
      enabled: false,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    { name: "orphic-web-search" },
  ),
);
