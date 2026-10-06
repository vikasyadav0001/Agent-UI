import type { StructuredToolInterface } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import { getMcpTools } from "@/lib/mcp";

/**
 * Tools bound to the model when "Web search" is on: Exa (via MCP) plus
 * Tavily (via @langchain/tavily). The model picks whichever fits the query.
 */
export async function getWebSearchTools(): Promise<StructuredToolInterface[]> {
  const tools: StructuredToolInterface[] = await getMcpTools();

  if (process.env.TAVILY_API_KEY) {
    tools.push(
      new TavilySearch({
        tavilyApiKey: process.env.TAVILY_API_KEY,
        maxResults: 5,
        includeAnswer: true,
      }),
    );
  }

  return tools;
}
