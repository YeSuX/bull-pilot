import type { AgentEvent } from "../agent/types";

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength)}...`;
}

export function renderEvent(event: AgentEvent): void {
  if (event.type === "thinking") {
    console.log(`[thinking] ${event.message}`);
    return;
  }

  if (event.type === "approval_request") {
    console.log(`[approval] ${event.name} requires approval`);
    console.log("Use /approve allow-once | /approve allow-session | /approve deny");
    return;
  }

  if (event.type === "approval_result") {
    console.log(`[approval_result] ${event.name}: ${event.decision}`);
    return;
  }

  if (event.type === "tool_start") {
    const input = truncate(JSON.stringify(event.input), 240);
    console.log(`[tool_start] ${event.name} ${input}`);
    return;
  }

  if (event.type === "tool_end") {
    if ("data" in event.output && "content" in event.output.data) {
      console.log(`[tool_end] ${event.name} content_length=${event.output.data.content.length}`);
      return;
    }

    console.log(`[tool_end] ${event.name}`);
    return;
  }

  if (event.type === "tool_error") {
    console.log(`[tool_error] ${event.name}: ${truncate(event.error, 240)}`);
    return;
  }

  console.log(`\nFinal Answer:\n${event.answer}`);
}
