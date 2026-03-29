import { runAgent, type LlmClient, type RunAgentOptions } from "../agent/run-agent";
import type { AgentEvent } from "../agent/types";
import type { ApprovalDecision, WorkingState } from "./types";
import type { ToolName } from "../tools/registry";
import { renderEvent } from "../ui/renderer";
import { renderWorkingState } from "../ui/working-indicator";
import { logger } from "../utils/logger";
import { ApprovalController } from "./approval";
import { InputHistoryController } from "./input-history";

type RunAgentFunction = (
  client: LlmClient,
  model: string,
  query: string,
  options: RunAgentOptions
) => AsyncGenerator<AgentEvent>;

type PendingApproval = {
  toolName: ToolName;
  resolve: (decision: ApprovalDecision) => void;
};

export class AgentRunnerController {
  private workingState: WorkingState = "idle";
  private abortController: AbortController | null = null;
  private currentRun: Promise<void> | null = null;
  private pendingApproval: PendingApproval | null = null;

  public constructor(
    private readonly client: LlmClient,
    private readonly getModelId: () => string,
    private readonly inputHistoryController: InputHistoryController,
    private readonly approvalController: ApprovalController,
    private readonly runner: RunAgentFunction = runAgent
  ) {}

  public isRunning(): boolean {
    return this.currentRun !== null;
  }

  public isWaitingApproval(): boolean {
    return this.pendingApproval !== null;
  }

  public getWorkingState(): WorkingState {
    return this.workingState;
  }

  public async runQuery(query: string): Promise<void> {
    if (this.currentRun) {
      throw new Error("Another query is still running");
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    this.currentRun = this.runQueryInternal(query, abortController);
    try {
      await this.currentRun;
    } finally {
      this.pendingApproval = null;
      this.abortController = null;
      this.currentRun = null;
      this.setState("idle");
    }
  }

  public cancel(): void {
    if (this.pendingApproval) {
      this.resolveApproval("deny");
      return;
    }

    this.abortController?.abort();
  }

  public approve(decision: ApprovalDecision): boolean {
    if (!this.pendingApproval) {
      return false;
    }

    this.resolveApproval(decision);
    return true;
  }

  public async waitForIdle(): Promise<void> {
    if (this.currentRun) {
      await this.currentRun;
    }
  }

  private async runQueryInternal(query: string, abortController: AbortController): Promise<void> {
    const modelId = this.getModelId();
    logger.info(`runQuery model=${modelId}`);

    let finalAnswer = "";
    for await (const event of this.runner(this.client, modelId, query, {
      maxIterations: 3,
      signal: abortController.signal,
      requestApproval: async ({ toolName }) => {
        if (this.approvalController.isSessionAllowed(toolName)) {
          return "allow-once";
        }

        this.setState("approval");
        return await new Promise<ApprovalDecision>((resolve) => {
          this.pendingApproval = {
            toolName,
            resolve
          };
        });
      }
    })) {
      this.updateStateFromEvent(event);
      renderEvent(event);

      if (event.type === "done") {
        finalAnswer = event.answer;
      }
    }

    await this.inputHistoryController.add(query, finalAnswer);
  }

  private resolveApproval(decision: ApprovalDecision): void {
    if (!this.pendingApproval) {
      return;
    }

    this.approvalController.apply(this.pendingApproval.toolName, decision);
    this.pendingApproval.resolve(decision);
    this.pendingApproval = null;
    this.setState("running");
  }

  private updateStateFromEvent(event: AgentEvent): void {
    if (event.type === "thinking") {
      this.setState("thinking");
      return;
    }

    if (event.type === "tool_start") {
      this.setState("tool");
      return;
    }

    if (event.type === "approval_request") {
      this.setState("approval");
      return;
    }

    if (event.type === "approval_result") {
      this.setState("running");
      return;
    }

    if (event.type === "done") {
      this.setState("idle");
    }
  }

  private setState(next: WorkingState | "running"): void {
    const normalized = next === "running" ? "thinking" : next;
    if (this.workingState === normalized) {
      return;
    }

    this.workingState = normalized;
    renderWorkingState(this.workingState);
    logger.debug(`workingState=${this.workingState}`);
  }
}
