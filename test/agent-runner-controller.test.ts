import { describe, expect, test } from "bun:test";
import { AgentRunnerController } from "../src/controllers/agent-runner";
import { InputHistoryController } from "../src/controllers/input-history";
import { ApprovalController } from "../src/controllers/approval";
import type { AgentEvent } from "../src/agent/types";
import type { LlmClient, RunAgentOptions } from "../src/agent/run-agent";
import { FakeUiAdapter } from "./fake-ui";

async function* mockRunner(
  _client: LlmClient,
  _model: string,
  _query: string,
  _options: RunAgentOptions
): AsyncGenerator<AgentEvent, void, void> {
  yield { type: "thinking", message: "running" };
  yield { type: "done", answer: "ok" };
}

describe("AgentRunnerController", () => {
  test("runs query and returns to idle", async () => {
    const history = new InputHistoryController();
    await history.init();
    const approval = new ApprovalController();
    const ui = new FakeUiAdapter();
    const client = {} as LlmClient;
    const controller = new AgentRunnerController(client, () => "mock-model", history, approval, ui, mockRunner);

    await controller.runQuery("hello");

    expect(controller.isRunning()).toBe(false);
    expect(controller.getWorkingState()).toBe("idle");
    const recent = history.getRecent(1);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0]?.query).toBe("hello");
    expect(ui.events.at(-1)?.type).toBe("done");
  });
});
