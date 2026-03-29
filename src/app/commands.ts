import type { AgentRunnerController } from "../controllers/agent-runner";
import type { InputHistoryController } from "../controllers/input-history";
import type { ModelSelectionController } from "../controllers/model-selection";
import type { ApprovalDecision } from "../controllers/types";
import { logger } from "../utils/logger";

export type CommandContext = {
  agentRunner: AgentRunnerController;
  inputHistory: InputHistoryController;
  modelSelection: ModelSelectionController;
};

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function handleCommand(input: string, context: CommandContext): Promise<boolean> {
  const [command, ...rest] = input.trim().split(/\s+/);

  if (command === "/help") {
    console.log("/help");
    console.log("/model [modelId]");
    console.log("/history [count]");
    console.log("/cancel");
    console.log("/approve allow-once|allow-session|deny");
    console.log("/exit");
    return false;
  }

  if (command === "/exit") {
    return true;
  }

  if (command === "/cancel") {
    context.agentRunner.cancel();
    return false;
  }

  if (command === "/model") {
    const nextModelId = rest[0];
    if (!nextModelId) {
      console.log(`current model: ${context.modelSelection.getModelId()}`);
      return false;
    }

    await context.modelSelection.setModelId(nextModelId);
    console.log(`model updated: ${context.modelSelection.getModelId()}`);
    return false;
  }

  if (command === "/history") {
    const count = parsePositiveInt(rest[0]) ?? 10;
    const items = context.inputHistory.getRecent(count);
    if (items.length === 0) {
      console.log("history is empty");
      return false;
    }

    for (const item of items) {
      console.log(`[${item.createdAt}] Q: ${item.query}`);
      console.log(`[${item.createdAt}] A: ${item.answer}`);
    }
    return false;
  }

  if (command === "/approve") {
    const value = rest[0];
    if (value !== "allow-once" && value !== "allow-session" && value !== "deny") {
      console.log("usage: /approve allow-once|allow-session|deny");
      return false;
    }

    const decision: ApprovalDecision = value;
    const handled = context.agentRunner.approve(decision);
    if (!handled) {
      console.log("no pending approval");
    }
    return false;
  }

  if (command === "/logs") {
    for (const entry of logger.getRecent()) {
      console.log(`[${entry.level}] ${entry.at} ${entry.message}`);
    }
    return false;
  }

  console.log(`unknown command: ${command}`);
  return false;
}
