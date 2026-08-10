import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { bindMcpToolsToModel, getMcpTools } from "@/lib/mcp";
import { DEFAULT_MODEL_ID } from "@/constants/model";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const taskInput = body.task || body.prompt || body.message;

    if (!taskInput) {
      return NextResponse.json(
        { status: "error", error: "Missing required 'task' string in request body." },
        { status: 400 }
      );
    }

    // Initialize base model using active Groq Qwen model (qwen/qwen3.6-27b)
    const baseModel = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: DEFAULT_MODEL_ID, // "qwen/qwen3.6-27b"
    });

    // Get tools & bind to model
    const tools = await getMcpTools();
    const activeModel = await bindMcpToolsToModel(baseModel as any);

    const systemPrompt = new SystemMessage(
      "You are Orphic, an autonomous AI agent handling a delegated task from another agent via A2A protocol. Provide concise, high-quality, and accurate results."
    );
    const userMessage = new HumanMessage(taskInput);

    const conversationHistory: BaseMessage[] = [systemPrompt, userMessage];
    let responseMessage: any = await activeModel.invoke(conversationHistory);
    conversationHistory.push(responseMessage);

    // If model returned tool calls (e.g. Exa Web Search), execute them automatically in a loop
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    let maxLoops = 5;

    while (responseMessage?.tool_calls?.length > 0 && maxLoops > 0) {
      maxLoops--;
      for (const toolCall of responseMessage.tool_calls) {
        const tool = toolMap.get(toolCall.name);
        if (tool) {
          console.log(`[A2A Executing Tool]: ${toolCall.name}`, toolCall.args);
          try {
            const toolResult = await tool.invoke(toolCall.args);
            conversationHistory.push(
              new ToolMessage({
                tool_call_id: toolCall.id || "",
                content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
              })
            );
          } catch (toolErr: any) {
            console.error(`[A2A Tool Error ${toolCall.name}]:`, toolErr);
            conversationHistory.push(
              new ToolMessage({
                tool_call_id: toolCall.id || "",
                content: `Tool error: ${toolErr?.message || "Execution failed"}`,
              })
            );
          }
        }
      }
      responseMessage = await activeModel.invoke(conversationHistory);
      conversationHistory.push(responseMessage);
    }

    // Extract text output reliably
    let outputText = "";
    if (typeof responseMessage.content === "string") {
      outputText = responseMessage.content;
    } else if (Array.isArray(responseMessage.content)) {
      outputText = responseMessage.content
        .map((c: any) => (typeof c === "string" ? c : c.text || ""))
        .join("\n");
    }

    return NextResponse.json({
      status: "completed",
      result: {
        output: outputText,
        metadata: {
          model: DEFAULT_MODEL_ID,
          agent: "Orphic Multi-Modal Agent",
        },
      },
    });
  } catch (error: any) {
    console.error("[A2A Task Error]:", error);
    return NextResponse.json(
      { status: "failed", error: error?.message || "Internal agent error" },
      { status: 500 }
    );
  }
}
