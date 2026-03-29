import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { AgentRunnerController } from "../controllers/agent-runner";
import type { InputHistoryController } from "../controllers/input-history";
import type { ModelSelectionController } from "../controllers/model-selection";
import { handleCommand } from "./commands";

export type AppControllers = {
  agentRunner: AgentRunnerController;
  inputHistory: InputHistoryController;
  modelSelection: ModelSelectionController;
};

export async function runApp(controllers: AppControllers): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  while (true) {
    const input = (await rl.question("bull-pilot> ")).trim();
    if (input.length === 0) {
      continue;
    }

    if (input.startsWith("/")) {
      const shouldExit = await handleCommand(input, controllers);
      if (shouldExit) {
        break;
      }
      continue;
    }

    if (controllers.agentRunner.isRunning()) {
      console.log("agent is running, use /cancel or wait");
      continue;
    }

    controllers.agentRunner.runQuery(input).catch((error: Error) => {
      console.log(`query failed: ${error.message}`);
    });
  }

  if (controllers.agentRunner.isRunning()) {
    controllers.agentRunner.cancel();
    await controllers.agentRunner.waitForIdle();
  }

  rl.close();
}
