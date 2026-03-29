import type { AgentRunnerController } from "../controllers/agent-runner";
import type { InputHistoryController } from "../controllers/input-history";
import type { ModelSelectionController } from "../controllers/model-selection";
import { t } from "../i18n";
import type { UiAdapter } from "../ui/adapter";
import { handleCommand } from "./commands";

export type AppControllers = {
  agentRunner: AgentRunnerController;
  inputHistory: InputHistoryController;
  modelSelection: ModelSelectionController;
  uiAdapter: UiAdapter;
};

export async function runApp(controllers: AppControllers): Promise<void> {
  await controllers.uiAdapter.start();
  controllers.uiAdapter.info(t("contextEnabled", { count: "12" }));

  while (true) {
    const input = (await controllers.uiAdapter.readInput(t("promptInput"))).trim();
    if (input.length === 0) {
      continue;
    }

    controllers.uiAdapter.info(t("userSaid", { input }));

    if (input.startsWith("/")) {
      const shouldExit = await handleCommand(input, controllers);
      if (shouldExit) {
        break;
      }
      continue;
    }

    if (controllers.agentRunner.isRunning()) {
      controllers.uiAdapter.info(t("cmdOnlyIdle"));
      continue;
    }

    await controllers.agentRunner.runQuery(input).catch((error: Error) => {
      controllers.uiAdapter.error(t("queryFailed", { message: error.message }));
    });
  }

  if (controllers.agentRunner.isRunning()) {
    controllers.agentRunner.cancel();
    await controllers.agentRunner.waitForIdle();
  }

  await controllers.uiAdapter.close();
}
