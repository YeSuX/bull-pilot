import type { AgentEvent } from "../src/agent/types";
import type { ApprovalDecision, WorkingState } from "../src/controllers/types";
import type { ToolName } from "../src/tools/registry";
import type { UiAdapter } from "../src/ui/adapter";

export class FakeUiAdapter implements UiAdapter {
  public readonly messages: string[] = [];
  public readonly events: AgentEvent[] = [];
  public readonly states: Array<{ state: WorkingState; modelId: string }> = [];

  public async start(): Promise<void> {}

  public async close(): Promise<void> {}

  public async readInput(_prompt: string): Promise<string> {
    return "";
  }

  public info(message: string): void {
    this.messages.push(message);
  }

  public error(message: string): void {
    this.messages.push(message);
  }

  public renderState(state: WorkingState, modelId: string): void {
    this.states.push({ state, modelId });
  }

  public renderEvent(event: AgentEvent): void {
    this.events.push(event);
  }

  public async requestApproval(_toolName: ToolName, _argsRaw: string): Promise<ApprovalDecision> {
    return "allow-once";
  }
}
