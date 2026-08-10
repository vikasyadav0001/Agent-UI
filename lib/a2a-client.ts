/**
 * Utility client to discover and delegate tasks to any A2A protocol-compliant agent.
 */
export async function delegateTaskToAgent(agentCardUrl: string, taskDescription: string) {
  try {
    // 1. Discover Agent capabilities & endpoints
    const cardResponse = await fetch(agentCardUrl);
    if (!cardResponse.ok) {
      throw new Error(`Failed to fetch agent card from ${agentCardUrl}`);
    }
    const agentCard = await cardResponse.json();
    const taskEndpoint = agentCard.endpoints?.tasks;

    if (!taskEndpoint) {
      throw new Error(`Agent card at ${agentCardUrl} does not expose a tasks endpoint.`);
    }

    // 2. Delegate task to the agent endpoint
    const taskResponse = await fetch(taskEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: taskDescription,
      }),
    });

    if (!taskResponse.ok) {
      throw new Error(`Agent task invocation failed with status ${taskResponse.status}`);
    }

    const taskResult = await taskResponse.json();
    return taskResult;
  } catch (error) {
    console.error("[A2A Delegation Error]:", error);
    throw error;
  }
}
