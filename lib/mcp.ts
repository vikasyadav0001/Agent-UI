import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { DynamicStructuredTool } from "@langchain/core/tools";

/**
 * Define your MCP Server configurations directly in this object.
 * You can register stdio, SSE, or Streamable HTTP servers here.
 */
export const mcpServersConfig: Record<string, any> = {
    "exa" : {
        "transport": "http",
        "url": "https://mcp.exa.ai/mcp",
        "headers": { "x-api-key": process.env.EXA_API_KEY || "" },
    }
};

let mcpClientInstance: MultiServerMCPClient | null = null;

/**
 * Initializes and returns the singleton MultiServerMCPClient instance.
 */
export async function getMcpClient(): Promise<MultiServerMCPClient | null> {
  if (Object.keys(mcpServersConfig).length === 0) {
    return null;
  }

  if (!mcpClientInstance) {
    try {
      mcpClientInstance = new MultiServerMCPClient(mcpServersConfig);
      await mcpClientInstance.initializeConnections();
      console.log("[MCP] Successfully connected to MCP servers:", Object.keys(mcpServersConfig));
    } catch (error) {
      console.error("[MCP] Connection error:", error);
      return null;
    }
  }

  return mcpClientInstance;
}

/**
 * Fetches all available tools from connected MCP servers defined in mcpServersConfig.
 */
export async function getMcpTools(): Promise<DynamicStructuredTool[]> {
  try {
    const client = await getMcpClient();
    if (!client) return [];
    return await client.getTools();
  } catch (error) {
    console.error("[MCP] Error retrieving tools:", error);
    return [];
  }
}

/**
 * Dynamically binds active MCP tools to the selected model (Groq, Mistral, etc.).
 * Returns the model bound with tools if tools exist, or the original model if none.
 */
export async function bindMcpToolsToModel<T extends { bindTools?: (tools: any[]) => any }>(
  model: T
): Promise<T> {
  const tools = await getMcpTools();

  if (tools.length > 0 && typeof model.bindTools === "function") {
    console.log(`[MCP] Binding ${tools.length} active MCP tools to model.`);
    return model.bindTools(tools) as T;
  }

  return model;
}
