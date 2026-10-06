import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  AIMessageChunk,
  SystemMessage,
  ToolMessage,
  BaseMessage,
  type UsageMetadata,
} from "@langchain/core/messages";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { getWebSearchTools } from "@/lib/web-search-tools";

// Ministral models have no reasoning, so effort only applies to Groq/OpenAI.
const EFFORT_LEVELS = ["none", "low", "medium", "high"] as const;

// Upper bound on model calls per request when tools are enabled.
const MAX_TOOL_STEPS = 5;

const WEB_SEARCH_ON_PROMPT =
  "You have web search tools. Use them whenever answering needs information you don't reliably have: current or real-time data (weather, news, prices, scores), events after your training cutoff, or specific facts you're unsure of. Search first instead of saying you lack access. Cite the sources you used.";

const WEB_SEARCH_OFF_PROMPT = `Web search is currently turned OFF, so you have no tools.

IMPORTANT: If the question needs current or real-time information (weather, news, prices, scores, tech, "latest"/"today"/"right now"), recent events, or specific facts you can't reliably know, you MUST include this sentence in your reply:
"Turn on **Web search** in the message box and send your message again, and I'll look it up."
Do not just tell the user to check another website or app. If you know a useful general answer, you may give it first, clearly marked as possibly out of date.

For everything else, answer normally without mentioning web search.`;

export async function POST(req: Request) {
  const body = await req.json();
  const {
    messages,
    system,
    modelName,
    model: modelFromReq,
    reasoningEffort,
    config,
    webSearch,
  }: {
    messages: UIMessage[];
    system?: string;
    modelName?: string;
    model?: string;
    reasoningEffort?: string;
    config?: { modelName?: string; reasoningEffort?: string };
    webSearch?: boolean;
  } = body;

  const selectedModelName =
    modelName ||
    modelFromReq ||
    config?.modelName ||
    "qwen/qwen3.8-27b";

  const requestedEffort = reasoningEffort || config?.reasoningEffort;
  const effort =
    EFFORT_LEVELS.find((level) => level === requestedEffort) ?? "low";

  const lowerModelName = selectedModelName.toLowerCase();
  const isOpenAI = lowerModelName.startsWith("openai/gpt-");
  const isMistral = /mistral|ministral|codestral/.test(lowerModelName);
  const cleanModelName = selectedModelName.includes("/")
    ? selectedModelName.split("/").pop()!
    : selectedModelName;

  const selectedModel: any = isOpenAI
    ? new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: cleanModelName,
        // Chat Completions rejects function tools + reasoning for GPT-6 models.
        useResponsesApi: true,
        reasoning:
          effort === "none" ? { effort } : { effort, summary: "auto" },
      })
    : isMistral
      ? new ChatMistralAI({
          apiKey: process.env.MISTRAL_API_KEY,
          model: cleanModelName,
        })
      : new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: selectedModelName,
          reasoningEffort: effort,
          // Free-tier Qwen has a 1,000 output-tokens-per-minute limit. Groq
          // rejects a request when (output in the last minute + max_tokens)
          // exceeds it, and without max_tokens it estimates from prompt size,
          // which rejects long chats outright. 700 leaves headroom for recent
          // output while keeping long chats under the limit.
          maxTokens: 700,
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

    // Text the user selected via "Quote" travels in metadata, not in parts.
    const quoteText = msg.metadata?.custom?.quote?.text;
    if (message.role === "user" && typeof quoteText === "string" && quoteText) {
      const blockquote = quoteText
        .split(/\r?\n/)
        .map((line: string) => `> ${line}`)
        .join("\n");
      contentParts.push({
        type: "text",
        text: `The user is referring to this part of an earlier message:\n${blockquote}\n\n`,
      });
    }

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
      // Tool schemas cost ~1k input tokens per call, so only bind them when
      // the user turned web search on.
      const tools = webSearch ? await getWebSearchTools() : [];
      const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
      const conversation = [...langchainMessages];

      // langchainMessages[0] is always the SystemMessage built above.
      const searchGuidance =
        tools.length > 0 ? WEB_SEARCH_ON_PROMPT : WEB_SEARCH_OFF_PROMPT;
      conversation[0] = new SystemMessage(
        `${conversation[0].content}\n\nToday's date is ${new Date().toDateString()}.\n\n${searchGuidance}`,
      );

      let reasoningId = "r0";
      let textId = "t0";
      let stepText = "";
      let inReasoning = false;
      let reasoningStarted = false;
      let reasoningEnded = false;
      let textStarted = false;
      let isFirstChunk = true;
      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      };
      let hasUsage = false;

      const ensureReasoningEnded = () => {
        if (reasoningStarted && !reasoningEnded) {
          writer.write({ type: "reasoning-end", id: reasoningId });
          reasoningEnded = true;
        }
      };

      const ensureTextEnded = () => {
        if (textStarted) {
          writer.write({ type: "text-end", id: textId });
          textStarted = false;
        }
      };

      const writeReasoning = (delta: string) => {
        if (!delta) return;
        if (!reasoningStarted) {
          writer.write({ type: "reasoning-start", id: reasoningId });
          reasoningStarted = true;
        }
        writer.write({ type: "reasoning-delta", id: reasoningId, delta });
      };

      const writeText = (delta: string) => {
        if (!delta) return;
        ensureReasoningEnded();
        if (!textStarted) {
          writer.write({ type: "text-start", id: textId });
          textStarted = true;
        }
        writer.write({ type: "text-delta", id: textId, delta });
        stepText += delta;
      };

      // Splits inline <think>...</think> output into reasoning and text.
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
            if (thinkIdx === -1) {
              writeText(buffer);
              break;
            }
            writeText(buffer.slice(0, thinkIdx));
            inReasoning = true;
            buffer = buffer.slice(thinkIdx + 7);
          } else {
            const endIdx = buffer.indexOf("</think>");
            if (endIdx === -1) {
              writeReasoning(buffer);
              break;
            }
            writeReasoning(buffer.slice(0, endIdx));
            ensureReasoningEnded();
            inReasoning = false;
            buffer = buffer.slice(endIdx + 8);
          }
        }
      };

      const addUsage = (stepUsage: UsageMetadata | undefined) => {
        if (!stepUsage) return;
        hasUsage = true;
        usage.inputTokens += stepUsage.input_tokens ?? 0;
        usage.outputTokens += stepUsage.output_tokens ?? 0;
        usage.reasoningTokens += stepUsage.output_token_details?.reasoning ?? 0;
        usage.cachedInputTokens +=
          stepUsage.input_token_details?.cache_read ?? 0;
      };

      // Runs one model call, streaming its text and reasoning to the client.
      const runStep = async (): Promise<AIMessage | AIMessageChunk | undefined> => {
        if (isMistral) {
          // Mistral's streamEvents() reports zero usage, and Ministral has no
          // reasoning to lose, so keep the chunk stream here.
          const model =
            tools.length > 0 ? selectedModel.bindTools(tools) : selectedModel;
          let full: AIMessageChunk | undefined;
          for await (const chunk of await model.stream(conversation)) {
            full = full ? full.concat(chunk) : chunk;
            if (typeof chunk.content === "string") {
              handleText(chunk.content);
            } else if (Array.isArray(chunk.content)) {
              for (const part of chunk.content) {
                if (typeof part === "string") handleText(part);
                else if (part?.type === "text") handleText(part.text);
              }
            }
          }
          addUsage(full?.usage_metadata);
          return full;
        }

        // streamEvents() keeps reasoning deltas that .stream() drops. ChatOpenAI
        // needs bindTools(); Groq's bound runnable lacks the new streamEvents(),
        // so its tools go in as call options instead.
        const model =
          isOpenAI && tools.length > 0
            ? selectedModel.bindTools(tools)
            : selectedModel;
        const events = model.streamEvents(
          conversation,
          !isOpenAI && tools.length > 0 ? { tools } : undefined,
        );
        for await (const event of events) {
          if (event.event !== "content-block-delta") continue;
          if (event.delta.type === "text-delta") handleText(event.delta.text);
          else if (event.delta.type === "reasoning-delta")
            writeReasoning(event.delta.reasoning);
        }
        const message: AIMessage = await events.output;
        addUsage(message.usage_metadata);
        return message;
      };

      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        reasoningId = `r${step}`;
        textId = `t${step}`;
        stepText = "";
        inReasoning = false;
        reasoningStarted = false;
        reasoningEnded = false;
        isFirstChunk = true;

        writer.write({ type: "start-step" });
        const message = await runStep();
        ensureReasoningEnded();
        ensureTextEnded();

        const toolCalls = message?.tool_calls ?? [];
        if (!message || toolCalls.length === 0 || step === MAX_TOOL_STEPS - 1) {
          writer.write({ type: "finish-step" });
          break;
        }

        // OpenAI needs its reasoning items replayed; other providers reject
        // reasoning content blocks, so send them just the text and tool calls.
        conversation.push(
          isOpenAI
            ? message
            : new AIMessage({ content: stepText, tool_calls: toolCalls }),
        );
        for (const call of toolCalls) {
          const toolCallId = call.id ?? `call_${step}_${call.name}`;
          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName: call.name,
            input: call.args,
            dynamic: true,
          });

          const tool = toolsByName.get(call.name);
          try {
            if (!tool) throw new Error(`Unknown tool: ${call.name}`);
            const result = await tool.invoke(call.args);
            const output =
              typeof result === "string" ? result : JSON.stringify(result);
            writer.write({
              type: "tool-output-available",
              toolCallId,
              output,
              dynamic: true,
            });
            conversation.push(
              new ToolMessage({ tool_call_id: toolCallId, content: output }),
            );
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error);
            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText,
              dynamic: true,
            });
            conversation.push(
              new ToolMessage({
                tool_call_id: toolCallId,
                content: `Error: ${errorText}`,
                status: "error",
              }),
            );
          }
        }
        writer.write({ type: "finish-step" });
      }

      if (hasUsage) {
        writer.write({
          type: "message-metadata",
          // assistant-ui only keeps `metadata.custom` on thread messages.
          messageMetadata: {
            custom: {
              modelId: selectedModelName,
              usage: {
                ...usage,
                totalTokens: usage.inputTokens + usage.outputTokens,
              },
            },
          },
        });
      }
    },
    onError: (error) => {
      console.error("[chat] Stream error:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}