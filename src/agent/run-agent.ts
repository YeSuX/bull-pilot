import type OpenAI from "openai";
import type { AgentEvent } from "./types";
import type { ApprovalDecision } from "../controllers/types";
import {
  executeTool,
  normalizeToolName,
  parseToolArgs,
  requiresApproval,
  tools,
  type ToolName
} from "../tools/registry";

type ApprovalRequest = {
  toolName: ToolName;
  argsRaw: string;
};

export type RunAgentOptions = {
  maxIterations?: number;
  signal?: AbortSignal;
  requestApproval?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
};

export type LlmClient = {
  chat: {
    completions: {
      create: (
        body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        options?: { signal?: AbortSignal }
      ) => Promise<OpenAI.Chat.Completions.ChatCompletion>;
    };
  };
};

function assistantContentToText(content: OpenAI.Chat.Completions.ChatCompletionMessage["content"]): string {
  return content ?? "";
}

function toAssistantMessageParam(
  message: OpenAI.Chat.Completions.ChatCompletionMessage
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return message as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
}

function isFunctionToolCall(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall {
  return call.type === "function";
}

function isAbortError(error: Error): boolean {
  return error.name === "AbortError";
}

export async function* runAgent(
  client: LlmClient,
  model: string,
  query: string,
  options: RunAgentOptions = {}
): AsyncGenerator<AgentEvent> {
  const maxIterations = options.maxIterations ?? 3;
  const signal = options.signal;
  const requestApproval = options.requestApproval;

  const systemPrompt = [
    "你是一个 CLI Agent。",
    "当问题需要外部数据时，优先调用工具。",
    "拿到足够工具结果后，直接给出最终答案，不要继续调用工具。"
  ].join(" ");

  let iteration = 0;
  let assistantMessageForNextRound: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam | null = null;
  let toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

  try {
    while (iteration < maxIterations) {
      if (signal?.aborted) {
        yield { type: "done", answer: "Execution interrupted" };
        return;
      }

      yield { type: "thinking", message: `Iteration ${iteration + 1}/${maxIterations}` };

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ];

      if (assistantMessageForNextRound) {
        messages.push(assistantMessageForNextRound);
        messages.push(...toolMessages);
      }

      const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        tools,
        tool_choice: "auto"
      };

      const completion = await client.chat.completions.create(request, { signal });

      const assistant = completion.choices[0]?.message;

      if (!assistant) {
        yield { type: "done", answer: "Model returned no message" };
        return;
      }

      const calls = assistant.tool_calls ?? [];
      if (calls.length === 0) {
        yield { type: "done", answer: assistantContentToText(assistant.content) || "No answer" };
        return;
      }

      toolMessages = [];

      for (const call of calls) {
        if (signal?.aborted) {
          yield { type: "done", answer: "Execution interrupted" };
          return;
        }

        if (!isFunctionToolCall(call)) {
          continue;
        }

        const toolName = normalizeToolName(call.function.name);
        const argsRaw = call.function.arguments || "{}";
        const args = parseToolArgs(toolName, argsRaw);

        if (requiresApproval(toolName)) {
          yield { type: "approval_request", name: toolName, input: args };
          if (!requestApproval) {
            yield { type: "approval_result", name: toolName, decision: "deny" };
            yield { type: "tool_error", name: toolName, error: "Approval handler is not configured" };
            yield { type: "done", answer: "Execution denied: approval is required" };
            return;
          }

          const decision = await requestApproval({ toolName, argsRaw });
          yield { type: "approval_result", name: toolName, decision };

          if (decision === "deny") {
            yield { type: "tool_error", name: toolName, error: "User denied tool execution" };
            yield { type: "done", answer: "Execution denied by user" };
            return;
          }
        }

        try {
          yield { type: "tool_start", name: toolName, input: args };
          const execution = await executeTool(toolName, args);
          yield { type: "tool_end", name: toolName, output: execution.result };

          toolMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(execution.result)
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          yield { type: "tool_error", name: toolName, error: message };

          toolMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: message })
          });
        }
      }

      assistantMessageForNextRound = toAssistantMessageParam(assistant);
      iteration += 1;
    }

    yield { type: "done", answer: "Reached max iterations without final answer" };
  } catch (error) {
    if (error instanceof Error && isAbortError(error)) {
      yield { type: "done", answer: "Execution interrupted" };
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    yield { type: "done", answer: `Agent failed: ${message}` };
  }
}
