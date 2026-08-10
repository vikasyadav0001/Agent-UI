import { NextResponse } from "next/server";

export async function GET() {
  const host = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const baseUrl = host.startsWith("http") ? host : `https://${host}`;

  const agentCard = {
    name: "Orphic Multi-Modal Agent",
    description: "An autonomous multi-modal agent capable of live web search, document analysis, and reasoning using Qwen and Mistral models.",
    version: "1.0.0",
    url: baseUrl,
    endpoints: {
      tasks: `${baseUrl}/api/a2a/tasks`,
    },
    capabilities: [
      {
        id: "web_search",
        name: "Live Web Search",
        description: "Executes real-time web queries using Exa MCP and returns synthesized research results.",
      },
      {
        id: "multimodal_vision",
        name: "Image & Vision Analysis",
        description: "Analyzes uploaded visual media and diagrams as a single unified whole.",
      },
    ],
    inputModes: ["text", "image"],
    outputModes: ["text", "json"],
    authentication: {
      type: "none", // or "bearer" when protecting with API key
    },
  };

  return NextResponse.json(agentCard);
}
