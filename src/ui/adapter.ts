import type { AgentEvent } from "../agent/types";
import type { ApprovalDecision, WorkingState } from "../controllers/types";
import type { ToolName } from "../tools/registry";

export interface UiAdapter {
  start(): Promise<void>;
  close(): Promise<void>;
  readInput(prompt: string): Promise<string>;
  info(message: string): void;
  error(message: string): void;
  renderState(state: WorkingState, modelId: string): void;
  renderEvent(event: AgentEvent): void;
  requestApproval(toolName: ToolName, argsRaw: string): Promise<ApprovalDecision>;
}
