import { describe, expect, test } from "bun:test";
import type OpenAI from "openai";
import { readFile, rm } from "node:fs/promises";
import { runAgent } from "../src/agent/run-agent";
import type { ApprovalDecision } from "../src/controllers/types";
import type { LlmClient } from "../src/agent/run-agent";

type CompletionResponse = OpenAI.Chat.Completions.ChatCompletion;

function createMockClient(path: string, content: string): LlmClient {
  let callCount = 0;

  const client = {
    chat: {
      completions: {
        async create(): Promise<CompletionResponse> {
          callCount += 1;

          if (callCount === 1) {
            return {
              id: "c1",
              object: "chat.completion",
              created: Date.now(),
              model: "mock",
              choices: [
              {
                index: 0,
                finish_reason: "tool_calls",
                logprobs: null,
                message: {
                  role: "assistant",
                  content: "",
                  refusal: null,
                  tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "write_file",
                          arguments: JSON.stringify({ path, content })
                        }
                      }
                    ]
                  }
                }
              ]
            };
          }

          return {
            id: "c2",
            object: "chat.completion",
            created: Date.now(),
            model: "mock",
            choices: [
              {
                index: 0,
                finish_reason: "stop",
                logprobs: null,
                message: {
                  role: "assistant",
                  content: "done",
                  refusal: null
                }
              }
            ]
          };
        }
      }
    }
  } as LlmClient;

  return client;
}

describe("approval integration", () => {
  test("deny blocks write tool", async () => {
    const events: string[] = [];
    const client = createMockClient("tmp-deny.txt", "hello");

    for await (const event of runAgent(client, "mock", "write file", {
      requestApproval: async (): Promise<ApprovalDecision> => "deny"
    })) {
      events.push(event.type);
    }

    expect(events.includes("approval_request")).toBe(true);
    expect(events.includes("approval_result")).toBe(true);
    expect(events.includes("done")).toBe(true);
    await rm("tmp-deny.txt", { force: true });
  });

  test("allow executes write tool", async () => {
    const path = "tmp-allow.txt";
    const content = "approved";
    const events: string[] = [];
    const client = createMockClient(path, content);

    for await (const event of runAgent(client, "mock", "write file", {
      requestApproval: async (): Promise<ApprovalDecision> => "allow-once"
    })) {
      events.push(event.type);
    }

    const file = await readFile(path, "utf-8");
    expect(file).toBe(content);
    expect(events.includes("tool_start")).toBe(true);
    expect(events.includes("tool_end")).toBe(true);
    await rm(path, { force: true });
  });
});
