import { ChatGroq } from "@langchain/groq";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

export async function POST(req: Request) {
  const {
    messages,
    system,
  }: {
    messages: UIMessage[];
    system?: string;
  } = await req.json();

  const langchainMessages: BaseMessage[] = [];

  if (system) {
    langchainMessages.push(new SystemMessage(system));
  }

  for (const message of messages) {
    let text = "";
    const msg = message as any;
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.parts)) {
      text = msg.parts
        .filter((p: any) => p.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("");
    }

    if (!text) continue;

    if (message.role === "system") {
      langchainMessages.push(new SystemMessage(text));
    } else if (message.role === "user") {
      langchainMessages.push(new HumanMessage(text));
    } else if (message.role === "assistant") {
      langchainMessages.push(new AIMessage(text));
    }
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "qwen/qwen3.6-27b",
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const responseStream = await model.stream(langchainMessages);

      let inReasoning = false;
      let reasoningStarted = false;
      let reasoningEnded = false;
      let textStarted = false;
      let isFirstChunk = true;

      const ensureReasoningStarted = () => {
        if (!reasoningStarted) {
          writer.write({ type: "reasoning-start", id: "r0" });
          reasoningStarted = true;
        }
      };

      const ensureReasoningEnded = () => {
        if (reasoningStarted && !reasoningEnded) {
          writer.write({ type: "reasoning-end", id: "r0" });
          reasoningEnded = true;
        }
      };

      const ensureTextStarted = () => {
        ensureReasoningEnded();
        if (!textStarted) {
          writer.write({ type: "text-start", id: "t0" });
          textStarted = true;
        }
      };

      const ensureTextEnded = () => {
        if (textStarted) {
          writer.write({ type: "text-end", id: "t0" });
          textStarted = false;
        }
      };

      const handleText = (text: string) => {
        let buffer = text;

        if (isFirstChunk) {
          isFirstChunk = false;
          const trimmed = buffer.trimStart();
          if (trimmed.startsWith("<think>")) {
            inReasoning = true;
            buffer = trimmed.slice(7);
          }
        }

        while (buffer.length > 0) {
          if (!inReasoning) {
            const thinkIdx = buffer.indexOf("<think>");
            if (thinkIdx !== -1) {
              const before = buffer.slice(0, thinkIdx);
              if (before) {
                ensureTextStarted();
                writer.write({ type: "text-delta", id: "t0", delta: before });
              }
              inReasoning = true;
              buffer = buffer.slice(thinkIdx + 7);
            } else {
              ensureTextStarted();
              writer.write({ type: "text-delta", id: "t0", delta: buffer });
              buffer = "";
            }
          } else {
            ensureReasoningStarted();
            const endIdx = buffer.indexOf("</think>");
            if (endIdx !== -1) {
              const reasoningText = buffer.slice(0, endIdx);
              if (reasoningText) {
                writer.write({
                  type: "reasoning-delta",
                  id: "r0",
                  delta: reasoningText,
                });
              }
              ensureReasoningEnded();
              inReasoning = false;
              buffer = buffer.slice(endIdx + 8);
            } else {
              writer.write({
                type: "reasoning-delta",
                id: "r0",
                delta: buffer,
              });
              buffer = "";
            }
          }
        }
      };

      for await (const chunk of responseStream) {
        // Intercept Groq specific reasoning_content if present in kwargs
        const reasoningContent = (chunk.additional_kwargs as any)?.reasoning_content;
        if (reasoningContent && typeof reasoningContent === "string") {
          ensureReasoningStarted();
          writer.write({
            type: "reasoning-delta",
            id: "r0",
            delta: reasoningContent,
          });
        }

        if (typeof chunk.content === "string" && chunk.content) {
          handleText(chunk.content);
        } else if (Array.isArray(chunk.content)) {
          for (const part of chunk.content) {
            if (typeof part === "string") {
              handleText(part);
            } else if (
              typeof part === "object" &&
              part !== null &&
              "text" in part &&
              typeof part.text === "string"
            ) {
              handleText(part.text);
            }
          }
        }
      }

      ensureReasoningEnded();
      ensureTextEnded();
    },
  });

  return createUIMessageStreamResponse({ stream });
}