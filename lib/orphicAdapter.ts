import { ChatModelAdapter } from "@assistant-ui/react";
import { chatResume, chatStream, createConversation } from "./api";

const NEW_CHAT_FALLBACK_TITLE = "New Conversation";
const RESUME_AUTH_MESSAGE = "[System: Resume Auth]";

const buildConversationTitle = (text: string) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === RESUME_AUTH_MESSAGE) {
    return NEW_CHAT_FALLBACK_TITLE;
  }
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
};

const normalizeSseBuffer = (value: string) =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const parseSseBlock = (block: string) => {
  const lines = block.split("\n");
  let eventType = "";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  return {
    eventType,
    dataStr: dataLines.join("\n"),
  };
};

const toolStatusFromPayload = (payload: any) => {
  if (payload.type === "interrupt") {
    return { type: "requires-action", options: [] as never[] } as const;
  }

  const status = payload.data?.status;
  if (status === "running") {
    return { type: "running" } as const;
  }
  if (status === "failed") {
    return { type: "incomplete", reason: "error" } as const;
  }
  return { type: "complete" } as const;
};

export const createOrphicAdapter = (
  initialThreadId: string,
  onNewThread?: (newThreadId: string) => void,
): ChatModelAdapter => {
  let activeThreadId = initialThreadId;
  let pendingThreadNavigationId: string | null = null;

  return {
    async *run({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];

      let text = "";
      const attachedFiles: File[] = [];

      if (lastMessage?.content) {
        for (const part of lastMessage.content as any[]) {
          if (part.type === "text") {
            text += part.text;
          } else if (part.type === "attachment") {
            const attachment = part as {
              file?: File;
              name?: string;
              content?: Array<{ type: string; image?: string }>;
            };

            if (attachment.file) {
              attachedFiles.push(attachment.file);
            } else if (attachment.content) {
              const image = attachment.content.find((entry) => entry.type === "image")?.image;
              if (image && !text) {
                text = `[attachment: ${attachment.name ?? "image"}](${image})`;
              }
            }
          }
        }
      }

      if (activeThreadId === "new") {
        try {
          const res = await createConversation(buildConversationTitle(text));
          if (res.ok) {
            const data = await res.json();
            activeThreadId = data.id || data.thread_id;
            pendingThreadNavigationId = activeThreadId || null;
          }
        } catch (error) {
          console.error("Failed to create conversation", error);
        }
      }

      if (activeThreadId === "new") {
        activeThreadId = `sess_${Math.random().toString(36).slice(2, 15)}`;
      }

      const formData = new FormData();
      formData.append("session_id", activeThreadId);

      attachedFiles.forEach((file, index) => {
        if (index === 0) {
          formData.append("file", file, file.name);
        }
        formData.append("files", file, file.name);
      });

      if (text && text !== RESUME_AUTH_MESSAGE) {
        formData.append("message", text);
      }

      const doResumeInterruptId = sessionStorage.getItem("do_resume");
      const response =
        text === RESUME_AUTH_MESSAGE && doResumeInterruptId
          ? await (async () => {
              sessionStorage.removeItem("do_resume");
              return chatResume(
                activeThreadId,
                {
                  interrupt_id: doResumeInterruptId,
                  decision: "connected",
                  input: {},
                },
                abortSignal,
              );
            })()
          : await chatStream(formData, abortSignal);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let didEmitAnyContent = false;
      let streamFinished = false;

      const toolCallMap = new Map<string, any>();
      const toolCallOrder: string[] = [];

      const buildContent = () => {
        const content: any[] = [];

        if (accumulatedText) {
          content.push({ type: "text", text: accumulatedText });
        }

        for (const toolCallId of toolCallOrder) {
          const toolCall = toolCallMap.get(toolCallId);
          if (toolCall) {
            content.push(toolCall);
          }
        }

        return content;
      };

      const applyPayload = (payload: any) => {
        if (payload.type === "token") {
          accumulatedText += payload.data?.text ?? "";
          return;
        }

        if (payload.type === "activity" || payload.type === "interrupt") {
          const toolCallId =
            payload.data?.id || `${payload.type}_${Math.random().toString(36).slice(2, 9)}`;

          if (!toolCallMap.has(toolCallId)) {
            toolCallOrder.push(toolCallId);
          }

          toolCallMap.set(toolCallId, {
            type: "tool-call",
            toolName: payload.type,
            toolCallId,
            args: payload.data,
            status: toolStatusFromPayload(payload),
          });
          return;
        }

        if (payload.type === "error") {
          accumulatedText += `\n\n[Error: ${payload.data?.message ?? "Unknown error"}]`;
        }
      };

      try {
        while (!streamFinished) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += normalizeSseBuffer(decoder.decode());
            break;
          }

          buffer += normalizeSseBuffer(decoder.decode(value, { stream: true }));
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const { eventType, dataStr } = parseSseBlock(block);
            if (!eventType) continue;

            if (eventType === "done") {
              streamFinished = true;
              break;
            }

            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);
              applyPayload(payload);
              const content = buildContent();
              didEmitAnyContent = didEmitAnyContent || content.length > 0;
              yield { content };
            } catch (error) {
              console.error("Failed to parse SSE JSON", error, dataStr);
            }
          }
        }

        const trailingBlock = buffer.trim();
        if (!streamFinished && trailingBlock) {
          const { eventType, dataStr } = parseSseBlock(trailingBlock);
          if (eventType === "done") {
            streamFinished = true;
          } else if (dataStr) {
            try {
              const payload = JSON.parse(dataStr);
              applyPayload(payload);
              const content = buildContent();
              didEmitAnyContent = didEmitAnyContent || content.length > 0;
              yield { content };
            } catch (error) {
              console.error("Failed to parse trailing SSE JSON", error, dataStr);
            }
          }
        }
      } finally {
        reader.releaseLock();

        if (pendingThreadNavigationId && onNewThread) {
          onNewThread(pendingThreadNavigationId);
          pendingThreadNavigationId = null;
        } else if (!didEmitAnyContent) {
          pendingThreadNavigationId = null;
        }
      }
    },
  };
};
