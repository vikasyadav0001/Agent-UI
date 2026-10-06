import { create } from "zustand";
import { persist } from "zustand/middleware";

export const EFFORT_LEVELS = ["none", "low", "medium", "high"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

type EffortState = {
  effort: Effort;
  setEffort: (effort: Effort) => void;
};

/** Reasoning effort sent with every chat request, regardless of model. */
export const useEffortStore = create<EffortState>()(
  persist(
    (set) => ({
      effort: "low",
      setEffort: (effort) => set({ effort }),
    }),
    { name: "orphic-effort" },
  ),
);
