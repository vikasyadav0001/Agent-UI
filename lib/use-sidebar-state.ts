"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "orphic-sidebar-collapsed";
const DEFAULT_COLLAPSED = false;

/**
 * Read the persisted sidebar state from localStorage.
 * Returns `DEFAULT_COLLAPSED` on the server or when storage is unavailable.
 */
function readPersistedState(): boolean {
  if (typeof window === "undefined") return DEFAULT_COLLAPSED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_COLLAPSED;
    return raw === "1";
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

function writePersistedState(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* storage may be unavailable (private mode / quota) — fall back silently */
  }
}

/**
 * Shared sidebar state hook.
 *
 * - Persists `collapsed` to localStorage (`orphic-sidebar-collapsed`).
 * - Listens for the `Cmd+B` / `Ctrl+B` keyboard shortcut to toggle.
 * - Stays in sync across tabs via the `storage` event.
 *
 * Use this anywhere a sidebar can be collapsed/expanded so the state is shared
 * across the chat layout and the connectors layout.
 */
export function useSidebarState(): {
  collapsed: boolean;
  setCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void;
  toggle: () => void;
} {
  // Lazy initial state — read from localStorage on the very first render.
  // `readPersistedState` returns `DEFAULT_COLLAPSED` on the server, so SSR
  // markup matches the first client paint.
  const [collapsed, setCollapsedState] = useState<boolean>(readPersistedState);

  // Stay in sync across tabs via the `storage` event.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setCollapsedState(readPersistedState());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Cmd/Ctrl+B to toggle. Ignore when typing in an editable element so the
  // browser's own bold shortcut (Ctrl+B) still works in inputs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key !== "b" && e.key !== "B") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox";
        if (isEditable) return;
      }
      e.preventDefault();
      setCollapsedState((prev) => {
        const next = !prev;
        writePersistedState(next);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setCollapsed = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        writePersistedState(value);
        return value;
      });
    },
    [],
  );

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writePersistedState(next);
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggle };
}
