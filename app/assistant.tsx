"use client";

import {
  AssistantRuntimeProvider,
  WebSpeechDictationAdapter,
  SimpleImageAttachmentAdapter,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Base } from "@/base";
import { useUsageStore, type TokenUsage } from "@/lib/usage-store";
import { useWebSearchStore } from "@/lib/web-search-store";
import { useEffortStore } from "@/lib/effort-store";

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ message }) => {
      const metadata = (
        message.metadata as
          | { custom?: { modelId?: string; usage?: Partial<TokenUsage> } }
          | undefined
      )?.custom;
      if (metadata?.usage) {
        useUsageStore
          .getState()
          .record(metadata.modelId ?? "unknown", metadata.usage);
      }
    },
    transport: new AssistantChatTransport({
      api: "/api/chat",
      body: () => ({
        webSearch: useWebSearchStore.getState().enabled,
        reasoningEffort: useEffortStore.getState().effort,
      }),
    }),
    adapters: {
      dictation: new WebSpeechDictationAdapter(),
      attachments: new SimpleImageAttachmentAdapter(),
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Base />
      </div>
    </AssistantRuntimeProvider>
  );
};
