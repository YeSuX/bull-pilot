import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { AgentEvent } from "../agent/types";
import type { ApprovalDecision, WorkingState } from "../controllers/types";
import { t } from "../i18n";
import type { ToolName } from "../tools/registry";
import type { UiAdapter } from "./adapter";
import { formatEvent } from "./renderer";
import { stateToLabel } from "./working-indicator";

function parseDecision(input: string): ApprovalDecision {
  if (input === "allow-once" || input === "allow-session" || input === "deny") {
    return input;
  }

  return "deny";
}

export class PlainAdapter implements UiAdapter {
  private readonly rl: Interface;
  private inStreamingAnswer = false;

  public constructor() {
    this.rl = createInterface({ input: stdin, output: stdout });
  }

  public async start(): Promise<void> {
    this.info(t("uiModePlain"));
  }

  public async close(): Promise<void> {
    this.rl.close();
  }

  public async readInput(prompt: string): Promise<string> {
    return await this.rl.question(`${prompt}> `);
  }

  public info(message: string): void {
    console.log(message);
  }

  public error(message: string): void {
    console.log(message);
  }

  public renderState(state: WorkingState, modelId: string): void {
    this.info(`模型: ${modelId} | 状态: ${stateToLabel(state)}`);
  }

  public renderEvent(event: AgentEvent): void {
    if (event.type === "answer_start") {
      this.inStreamingAnswer = true;
      this.info(t("assistantAnswer"));
      this.info(t("finalAnswer"));
      return;
    }

    if (event.type === "answer_delta") {
      process.stdout.write(event.delta);
      return;
    }

    if (event.type === "answer_end") {
      process.stdout.write("\n\n");
      this.inStreamingAnswer = false;
      return;
    }

    if (event.type === "done" && this.inStreamingAnswer) {
      return;
    }

    for (const line of formatEvent(event)) {
      this.info(line);
    }
  }

  public async requestApproval(toolName: ToolName, _argsRaw: string): Promise<ApprovalDecision> {
    const answer = await this.rl.question(`${t("plainApprovalQuestion", { tool: toolName })} `);
    const normalized = parseDecision(answer.trim());
    if (normalized === "deny" && answer.trim() !== "deny") {
      this.info(t("plainApprovalInvalid"));
    }
    return normalized;
  }
}
