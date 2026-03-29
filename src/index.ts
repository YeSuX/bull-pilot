import "dotenv/config";
import { createLlmClient } from "./model/client";
import { runApp } from "./app/run-app";
import { AgentRunnerController } from "./controllers/agent-runner";
import { ApprovalController } from "./controllers/approval";
import { InputHistoryController } from "./controllers/input-history";
import { ModelSelectionController } from "./controllers/model-selection";
import { t } from "./i18n";
import { createUiAdapter, resolveUiMode } from "./ui/create-adapter";

async function main(): Promise<void> {
  const client = createLlmClient();
  const modelSelection = new ModelSelectionController();
  await modelSelection.init();

  const inputHistory = new InputHistoryController();
  await inputHistory.init();

  const approval = new ApprovalController();
  const mode = resolveUiMode(process.argv.slice(2), process.env.UI_MODE, Boolean(process.stdout.isTTY));
  const uiAdapter = createUiAdapter({
    mode,
    getModelId: () => modelSelection.getModelId()
  });
  if (mode === "plain" && process.argv.includes("--plain")) {
    uiAdapter.info(t("argPlainEnabled"));
  }

  const agentRunner = new AgentRunnerController(
    client,
    () => modelSelection.getModelId(),
    inputHistory,
    approval,
    uiAdapter
  );

  process.on("SIGINT", () => {
    if (agentRunner.isRunning()) {
      agentRunner.cancel();
      return;
    }
    process.exit(0);
  });

  await runApp({
    agentRunner,
    inputHistory,
    modelSelection,
    uiAdapter
  });
}

main().catch((error: Error) => {
  console.error(t("fatal", { message: error.message }));
  process.exit(1);
});
