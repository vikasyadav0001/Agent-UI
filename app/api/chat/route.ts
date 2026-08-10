import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
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
import { bindMcpToolsToModel } from "@/lib/mcp";

export async function POST(req: Request) {
  const body = await req.json();
  const {
    messages,
    system,
    modelName,
    model: modelFromReq,
    reasoningEffort,
    config,
  }: {
    messages: UIMessage[];
    system?: string;
    modelName?: string;
    model?: string;
    reasoningEffort?: string;
    config?: { modelName?: string; reasoningEffort?: string };
  } = body;

  const selectedModelName =
    modelName ||
    modelFromReq ||
    config?.modelName ||
    "qwen/qwen3.6-27b";

  const effort = reasoningEffort || config?.reasoningEffort;

  const isMistral = selectedModelName.toLowerCase().includes("mistral");
  const cleanMistralModel = selectedModelName.includes("/")
    ? selectedModelName.split("/").pop()!
    : selectedModelName;

  const selectedModel: any = isMistral
    ? new ChatMistralAI({
        apiKey: process.env.MISTRAL_API_KEY,
        model: cleanMistralModel,
      })
    : new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: selectedModelName,
      });

  const langchainMessages: BaseMessage[] = [];

  const imageSystemInstruction =
    "When analyzing images, describe and analyze the image as a single unified whole. Never divide or refer to your description in patches, sub-crops, or sections (such as 'Top Section', 'Bottom Section', 'Middle Section', etc.). Respond naturally as if viewing one cohesive photo or graphic.";

  if (system) {
    langchainMessages.push(new SystemMessage(`${imageSystemInstruction}\n\n${system}`));
  } else {
    langchainMessages.push(new SystemMessage(imageSystemInstruction));
  }

  for (const message of messages) {
    const msg = message as any;
    const contentParts: any[] = [];

    const seenImageUrls = new Set<string>();

    if (typeof msg.content === "string") {
      contentParts.push({ type: "text", text: msg.content });
    } else if (Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        if (part.type === "text" && typeof part.text === "string") {
          contentParts.push({ type: "text", text: part.text });
        } else if (
          part.type === "image" ||
          part.type === "image_url" ||
          part.type === "file"
        ) {
          const url =
            part.image ||
            part.url ||
            part.image_url?.url ||
            (typeof part.data === "string" ? part.data : undefined);
          const urlStr = typeof url === "string" ? url : url?.url;
          if (urlStr && !seenImageUrls.has(urlStr)) {
            seenImageUrls.add(urlStr);
            contentParts.push({
              type: "image_url",
              image_url: { url: urlStr },
            });
          }
        }
      }
    }

    if (Array.isArray(msg.attachments)) {
      for (const attachment of msg.attachments) {
        if (
          attachment.type === "image" ||
          attachment.contentType?.startsWith("image/")
        ) {
          const url = attachment.url || attachment.content;
          const urlStr = typeof url === "string" ? url : url?.url;
          if (urlStr && !seenImageUrls.has(urlStr)) {
            seenImageUrls.add(urlStr);
            contentParts.push({
              type: "image_url",
              image_url: { url: urlStr },
            });
          }
        }
      }
    }

    if (contentParts.length === 0) continue;

    const messageContent =
      contentParts.length === 1 && contentParts[0].type === "text"
        ? contentParts[0].text
        : contentParts;

    if (message.role === "system") {
      langchainMessages.push(new SystemMessage(messageContent));
    } else if (message.role === "user") {
      langchainMessages.push(new HumanMessage({ content: messageContent }));
    } else if (message.role === "assistant") {
      langchainMessages.push(new AIMessage({ content: messageContent }));
    }
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const activeModel = await bindMcpToolsToModel(selectedModel as any);
      const responseStream = await activeModel.stream(langchainMessages);

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