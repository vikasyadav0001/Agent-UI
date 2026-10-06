"use client";

import { useAuiState } from "@assistant-ui/react";
import { getThreadMessageTokenUsage } from "@assistant-ui/react-ai-sdk";
import { CoinsIcon } from "lucide-react";
import { useEffect, useState, type FC, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/radix/tooltip";
import { MODELS } from "@/constants/model";
import { formatTokens, todayKey, useUsageStore } from "@/lib/usage-store";
import { cn } from "@/lib/utils";

const modelLabel = (id: string) =>
  MODELS.find((m) => m.value === id)?.name ?? id;

const Row: FC<{ label: ReactNode; value: number; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between gap-6">
    <span className={strong ? "font-medium" : "text-muted-foreground"}>
      {label}
    </span>
    <span className="font-mono tabular-nums">{value.toLocaleString()}</span>
  </div>
);

/** Today's token total across all chats, stored in this browser. */
export const TodayTokenUsage: FC<{ className?: string }> = ({ className }) => {
  // Usage lives in localStorage; render only after mount to avoid a
  // server/client hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = useUsageStore((s) => s.days[todayKey()]);

  if (!mounted) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Token usage today"
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-8 items-center gap-1.5 rounded-md px-2 font-mono text-xs tabular-nums transition-colors",
            className,
          )}
        >
          <CoinsIcon className="size-3.5" />
          {formatTokens(today?.totalTokens ?? 0)} today
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={6}>
        <div className="grid min-w-48 gap-1.5 text-xs">
          <Row label="Input" value={today?.inputTokens ?? 0} />
          <Row label="Output" value={today?.outputTokens ?? 0} />
          <Row label="Total" value={today?.totalTokens ?? 0} strong />
          <Row label="Requests" value={today?.requests ?? 0} />
          {today && Object.keys(today.byModel).length > 0 && (
            <div className="mt-1 grid gap-1.5 border-t pt-1.5">
              {Object.entries(today.byModel)
                .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
                .map(([id, u]) => (
                  <Row key={id} label={modelLabel(id)} value={u.totalTokens} />
                ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

/** Token usage for a single assistant message. Place inside the action bar. */
export const MessageTokenUsage: FC<{ className?: string }> = ({
  className,
}) => {
  const input = useAuiState(
    (s) => getThreadMessageTokenUsage(s.message)?.inputTokens,
  );
  const output = useAuiState(
    (s) => getThreadMessageTokenUsage(s.message)?.outputTokens,
  );
  const total = useAuiState(
    (s) => getThreadMessageTokenUsage(s.message)?.totalTokens,
  );
  if (total === undefined) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Message token usage"
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center rounded-md p-1 font-mono text-xs tabular-nums transition-colors",
            className,
          )}
        >
          {formatTokens(total)} tok
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <div className="grid min-w-35 gap-1.5 text-xs">
          <Row label="Input" value={input ?? 0} />
          <Row label="Output" value={output ?? 0} />
          <Row label="Total" value={total} strong />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
