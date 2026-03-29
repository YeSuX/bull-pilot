import type { AgentRunnerController } from "../controllers/agent-runner";
import type { InputHistoryController } from "../controllers/input-history";
import type { ModelSelectionController } from "../controllers/model-selection";
import { t } from "../i18n";
import type { UiAdapter } from "../ui/adapter";
import { logger } from "../utils/logger";
import type { LogLevel } from "../utils/logger";

export type CommandContext = {
  agentRunner: AgentRunnerController;
  inputHistory: InputHistoryController;
  modelSelection: ModelSelectionController;
  uiAdapter: UiAdapter;
};

function levelToZh(level: LogLevel): string {
  if (level === "debug") {
    return "调试";
  }

  if (level === "info") {
    return "信息";
  }

  if (level === "warn") {
    return "警告";
  }

  return "错误";
}

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
  const commandName = command ?? "";

  if (commandName === "/help") {
    context.uiAdapter.info(t("cmdHelpTitle"));
    context.uiAdapter.info(t("cmdHelpModel"));
    context.uiAdapter.info(t("cmdHelpHistory"));
    context.uiAdapter.info(t("cmdHelpCancel"));
    context.uiAdapter.info(t("cmdLogs"));
    context.uiAdapter.info(t("cmdHelpExit"));
    return false;
  }

  if (commandName === "/exit") {
    return true;
  }

  if (commandName === "/cancel") {
    context.agentRunner.cancel();
    return false;
  }

  if (commandName === "/model") {
    const nextModelId = rest[0];
    if (!nextModelId) {
      context.uiAdapter.info(t("cmdCurrentModel", { model: context.modelSelection.getModelId() }));
      return false;
    }

    await context.modelSelection.setModelId(nextModelId);
    context.uiAdapter.info(t("cmdModelUpdated", { model: context.modelSelection.getModelId() }));
    return false;
  }

  if (commandName === "/history") {
    const rawCount = rest[0];
    const parsedCount = parsePositiveInt(rawCount);
    if (rawCount && parsedCount === null) {
      context.uiAdapter.info(t("cmdInvalidCount"));
    }

    const count = parsedCount ?? 10;
    const items = context.inputHistory.getRecent(count);
    if (items.length === 0) {
      context.uiAdapter.info(t("cmdHistoryEmpty"));
      return false;
    }

    for (const item of items) {
      context.uiAdapter.info(`[${item.createdAt}] ${t("cmdHistoryQuery")}: ${item.query}`);
      context.uiAdapter.info(`[${item.createdAt}] ${t("cmdHistoryAnswer")}: ${item.answer}`);
    }
    return false;
  }

  if (commandName === "/logs") {
    const entries = logger.getRecent();
    if (entries.length === 0) {
      context.uiAdapter.info(t("logsEmpty"));
      return false;
    }

    for (const entry of entries) {
      context.uiAdapter.info(`[${levelToZh(entry.level)}] ${entry.at} ${entry.message}`);
    }
    return false;
  }

  context.uiAdapter.error(t("cmdUnknown", { command: commandName }));
  return false;
}
