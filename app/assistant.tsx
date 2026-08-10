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

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
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
