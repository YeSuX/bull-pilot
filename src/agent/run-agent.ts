import type OpenAI from "openai";
import type { AgentEvent } from "./types";
import type { ApprovalDecision } from "../controllers/types";
import { t } from "../i18n";
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

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RunAgentOptions = {
  maxIterations?: number;
  signal?: AbortSignal;
  requestApproval?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  history?: ConversationMessage[];
  streamChunkSize?: number;
  streamChunkDelayMs?: number;
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

function splitToChunks(text: string, chunkSize: number): string[] {
  if (text.length === 0) {
    return [""];
  }

  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.slice(index, index + chunkSize));
    index += chunkSize;
  }
  return chunks;
}

async function waitMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function* streamAnswer(
  answer: string,
  signal: AbortSignal | undefined,
  chunkSize: number,
  delayMs: number
): AsyncGenerator<AgentEvent> {
  yield { type: "answer_start" };
  for (const chunk of splitToChunks(answer, chunkSize)) {
    if (signal?.aborted) {
      yield { type: "done", answer: t("runInterrupted") };
      return;
    }
    yield { type: "answer_delta", delta: chunk };
    await waitMs(delayMs);
  }
  yield { type: "answer_end" };
  yield { type: "done", answer };
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
  const history = options.history ?? [];
  const streamChunkSize = options.streamChunkSize ?? 24;
  const streamChunkDelayMs = options.streamChunkDelayMs ?? 15;

  const systemPrompt = [
    "你是一个 CLI Agent。",
    "当问题需要外部数据时，优先调用工具。",
    "拿到足够工具结果后，直接给出最终答案，不要继续调用工具。"
  ].join(" ");

  let iteration = 0;
  let assistantMessageForNextRound: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam | null = null;
  let toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: query }
  ];

  try {
    while (iteration < maxIterations) {
      if (signal?.aborted) {
        yield { type: "done", answer: t("runInterrupted") };
        return;
      }

      yield { type: "thinking", message: `第 ${iteration + 1}/${maxIterations} 轮` };

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...baseMessages];

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
        yield { type: "done", answer: t("modelNoMessage") };
        return;
      }

      const calls = assistant.tool_calls ?? [];
      if (calls.length === 0) {
        const answer = assistantContentToText(assistant.content) || t("noAnswer");
        yield* streamAnswer(answer, signal, streamChunkSize, streamChunkDelayMs);
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
            yield { type: "tool_error", name: toolName, error: t("approvalHandlerMissing") };
            yield { type: "done", answer: t("approvalDeniedNeed") };
            return;
          }

          const decision = await requestApproval({ toolName, argsRaw });
          yield { type: "approval_result", name: toolName, decision };

          if (decision === "deny") {
            yield { type: "tool_error", name: toolName, error: t("approvalDeniedByUser") };
            yield { type: "done", answer: t("approvalDeniedByUser") };
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

    const convergePrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "user",
      content: "请基于现有上下文和已有工具结果，直接给出最终可执行答案，不要继续调用任何工具。"
    };

    const convergeMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...baseMessages,
      ...(assistantMessageForNextRound ? [assistantMessageForNextRound] : []),
      ...toolMessages,
      convergePrompt
    ];

    const convergeRequest: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: convergeMessages
    };

    const convergeCompletion = await client.chat.completions.create(convergeRequest, { signal });
    const convergeAssistant = convergeCompletion.choices[0]?.message;
    const convergeAnswer = convergeAssistant ? assistantContentToText(convergeAssistant.content) : "";

    if (convergeAnswer.length > 0) {
      yield* streamAnswer(convergeAnswer, signal, streamChunkSize, streamChunkDelayMs);
      return;
    }

    yield* streamAnswer(t("maxIterationReached"), signal, streamChunkSize, streamChunkDelayMs);
  } catch (error) {
    if (error instanceof Error && isAbortError(error)) {
      yield { type: "done", answer: t("runInterrupted") };
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    yield { type: "done", answer: t("agentFailed", { message }) };
  }
}
