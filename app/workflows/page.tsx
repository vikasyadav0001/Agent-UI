"use client";

import { Assistant } from "../chat/assistant";
import { Sidebar } from "@/components/assistant-ui/sidebar";
import { useSidebarState } from "@/lib/use-sidebar-state";
import { PanelLeftIcon, SparklesIcon, WorkflowIcon } from "lucide-react";

export default function WorkflowsPage() {
  const { collapsed, toggle } = useSidebarState();

  return (
    <main className="h-dvh w-full flex">
      <Assistant threadId="new">
        <Sidebar collapsed={collapsed} />

        <div className="flex-1 overflow-y-auto relative">
          <button
            onClick={toggle}
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            className="absolute top-4 left-4 z-10 flex items-center justify-center size-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftIcon className="size-5" />
          </button>

          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <WorkflowIcon className="size-7 text-white/70" />
              </div>
              <h1 className="text-2xl font-semibold text-white/90">
                Workflows are on the way
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Chain tools and saved prompts into reusable, multi-step recipes
                you can fire off with a single click. This page is a placeholder
                for now — the real builder is coming soon.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 ring-1 ring-white/10">
                <SparklesIcon className="size-3.5 text-white/40" />
                Coming soon
              </div>
            </div>
          </div>
        </div>
      </Assistant>
    </main>
  );
}
