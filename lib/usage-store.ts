import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type DailyUsage = TokenUsage & {
  requests: number;
  byModel: Record<string, TokenUsage & { requests: number }>;
};

type UsageState = {
  days: Record<string, DailyUsage>;
  record: (modelId: string, usage: Partial<TokenUsage>) => void;
};

const MAX_DAYS_KEPT = 30;

// Local calendar date (YYYY-MM-DD), so "today" matches the user's clock.
export const todayKey = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addUsage = <T extends TokenUsage & { requests: number }>(
  base: T | undefined,
  usage: TokenUsage,
) => ({
  inputTokens: (base?.inputTokens ?? 0) + usage.inputTokens,
  outputTokens: (base?.outputTokens ?? 0) + usage.outputTokens,
  totalTokens: (base?.totalTokens ?? 0) + usage.totalTokens,
  requests: (base?.requests ?? 0) + 1,
});

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      days: {},
      record: (modelId, partial) => {
        const inputTokens = partial.inputTokens ?? 0;
        const outputTokens = partial.outputTokens ?? 0;
        const usage = {
          inputTokens,
          outputTokens,
          totalTokens: partial.totalTokens ?? inputTokens + outputTokens,
        };
        if (usage.totalTokens === 0) return;

        set((state) => {
          const key = todayKey();
          const day = state.days[key];
          const days = {
            ...state.days,
            [key]: {
              ...addUsage(day, usage),
              byModel: {
                ...day?.byModel,
                [modelId]: addUsage(day?.byModel[modelId], usage),
              },
            },
          };
          const keep = Object.keys(days).sort().slice(-MAX_DAYS_KEPT);
          return {
            days: Object.fromEntries(keep.map((k) => [k, days[k]!])),
          };
        });
      },
    }),
    { name: "orphic-token-usage" },
  ),
);

export const formatTokens = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : String(n);
