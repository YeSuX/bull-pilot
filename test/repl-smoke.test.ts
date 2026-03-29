import { describe, expect, test } from "bun:test";
import { AgentRunnerController } from "../src/controllers/agent-runner";
import { ApprovalController } from "../src/controllers/approval";
import { InputHistoryController } from "../src/controllers/input-history";
import type { AgentEvent } from "../src/agent/types";
import type { LlmClient, RunAgentOptions } from "../src/agent/run-agent";
import { handleCommand } from "../src/app/commands";
import { ModelSelectionController } from "../src/controllers/model-selection";
import { FakeUiAdapter } from "./fake-ui";

async function* sequentialRunner(
  _client: LlmClient,
  _model: string,
  query: string,
  _options: RunAgentOptions
): AsyncGenerator<AgentEvent, void, void> {
  yield { type: "thinking", message: `query=${query}` };
  yield { type: "done", answer: `answer=${query}` };
}

describe("repl smoke", () => {
  test("command routing and multi-query history", async () => {
    const history = new InputHistoryController();
    await history.init();
    const approval = new ApprovalController();
    const model = new ModelSelectionController();
    await model.init();
    const ui = new FakeUiAdapter();
    const client = {} as LlmClient;

    const runner = new AgentRunnerController(client, () => model.getModelId(), history, approval, ui, sequentialRunner);
    await runner.runQuery("first");
    await runner.runQuery("second");

    const shouldExit = await handleCommand("/help", {
      agentRunner: runner,
      inputHistory: history,
      modelSelection: model,
      uiAdapter: ui
    });

    expect(shouldExit).toBe(false);
    const recent = history.getRecent(2);
    expect(recent.length).toBeGreaterThanOrEqual(2);
    expect(recent[recent.length - 1]?.query).toBe("second");
  });
});
