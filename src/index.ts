import "dotenv/config";
import { createLlmClient } from "./model/client";
import { runApp } from "./app/run-app";
import { AgentRunnerController } from "./controllers/agent-runner";
import { ApprovalController } from "./controllers/approval";
import { InputHistoryController } from "./controllers/input-history";
import { ModelSelectionController } from "./controllers/model-selection";

async function main(): Promise<void> {
  const client = createLlmClient();
  const modelSelection = new ModelSelectionController();
  await modelSelection.init();

  const inputHistory = new InputHistoryController();
  await inputHistory.init();

  const approval = new ApprovalController();
  const agentRunner = new AgentRunnerController(
    client,
    () => modelSelection.getModelId(),
    inputHistory,
    approval
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
    modelSelection
  });
}

main().catch((error: Error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
