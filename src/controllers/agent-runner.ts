import {
  runAgent,
  type ConversationMessage,
  type LlmClient,
  type RunAgentOptions
} from "../agent/run-agent";
import type { AgentEvent } from "../agent/types";
import type { WorkingState } from "./types";
import { logger } from "../utils/logger";
import { ApprovalController } from "./approval";
import { InputHistoryController } from "./input-history";
import type { UiAdapter } from "../ui/adapter";

type RunAgentFunction = (
  client: LlmClient,
  model: string,
  query: string,
  options: RunAgentOptions
) => AsyncGenerator<AgentEvent>;

export class AgentRunnerController {
  private workingState: WorkingState = "idle";
  private abortController: AbortController | null = null;
  private currentRun: Promise<void> | null = null;
  private readonly conversation: ConversationMessage[] = [];

  public constructor(
    private readonly client: LlmClient,
    private readonly getModelId: () => string,
    private readonly inputHistoryController: InputHistoryController,
    private readonly approvalController: ApprovalController,
    private readonly uiAdapter: UiAdapter,
    private readonly runner: RunAgentFunction = runAgent
  ) {}

  public isRunning(): boolean {
    return this.currentRun !== null;
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
      this.abortController = null;
      this.currentRun = null;
      this.setState("idle");
    }
  }

  public cancel(): void {
    this.abortController?.abort();
  }

  public async waitForIdle(): Promise<void> {
    if (this.currentRun) {
      await this.currentRun;
    }
  }

  private async runQueryInternal(query: string, abortController: AbortController): Promise<void> {
    const modelId = this.getModelId();
    logger.info(`开始执行请求，模型=${modelId}`);
    this.uiAdapter.renderState(this.workingState, modelId);

    let finalAnswer = "";
    for await (const event of this.runner(this.client, modelId, query, {
      maxIterations: 3,
      signal: abortController.signal,
      history: this.getConversationHistory(12),
      requestApproval: async ({ toolName, argsRaw }) => {
        if (this.approvalController.isSessionAllowed(toolName)) {
          return "allow-once";
        }

        this.setState("approval");
        const decision = await this.uiAdapter.requestApproval(toolName, argsRaw);
        this.approvalController.apply(toolName, decision);
        return decision;
      }
    })) {
      this.updateStateFromEvent(event);
      this.uiAdapter.renderEvent(event);

      if (event.type === "done") {
        finalAnswer = event.answer;
      }
    }

    this.conversation.push({ role: "user", content: query });
    this.conversation.push({ role: "assistant", content: finalAnswer });
    await this.inputHistoryController.add(query, finalAnswer);
  }

  private getConversationHistory(maxTurns: number): ConversationMessage[] {
    const count = maxTurns > 0 ? maxTurns * 2 : 24;
    if (this.conversation.length <= count) {
      return [...this.conversation];
    }

    return this.conversation.slice(this.conversation.length - count);
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
    this.uiAdapter.renderState(this.workingState, this.getModelId());
    logger.debug(`状态切换=${this.workingState}`);
  }
}
