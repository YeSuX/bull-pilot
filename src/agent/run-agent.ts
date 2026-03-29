import type OpenAI from "openai";
import type { AgentEvent } from "./types";
import { executeTool, normalizeToolName, tools } from "../tools/registry";
import { parseReadFileArgs } from "../tools/read-file";

function assistantContentToText(content: OpenAI.Chat.Completions.ChatCompletionMessage["content"]): string {
  return content ?? "";
}

function isFunctionToolCall(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall {
  return call.type === "function";
}

function toAssistantMessageParam(
  message: OpenAI.Chat.Completions.ChatCompletionMessage
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  // 直接复用模型返回的 assistant 消息，保留 provider 扩展字段（如 reasoning_content）
  return message as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
}

export async function* runAgent(
  client: OpenAI,
  model: string,
  query: string,
  maxIterations: number = 2
): AsyncGenerator<AgentEvent> {
  const systemPrompt = [
    "你是一个 CLI Agent。",
    "当问题需要外部数据时，优先调用工具。",
    "拿到足够工具结果后，直接给出最终答案，不要继续调用工具。"
  ].join(" ");

  yield { type: "thinking", message: "Analyzing query" };

  let iteration = 0;
  let assistantMessageForNextRound: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam | null = null;
  let toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

  try {
    while (iteration < maxIterations) {
      yield { type: "thinking", message: `Iteration ${iteration + 1}/${maxIterations}` };

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ];

      if (assistantMessageForNextRound) {
        // 第二轮必须回传首轮 assistant tool_call 消息，否则部分 provider 会校验失败
        messages.push(assistantMessageForNextRound);
        messages.push(...toolMessages);
      }

      const completion = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto"
      });

      const assistant = completion.choices[0]?.message;

      if (!assistant) {
        yield { type: "done", answer: "Model returned no message" };
        return;
      }

      const calls = assistant.tool_calls ?? [];

      if (calls.length === 0) {
        yield {
          type: "done",
          answer: assistantContentToText(assistant.content) || "No answer"
        };
        return;
      }

      yield { type: "thinking", message: `Model requested ${calls.length} tool call(s)` };
      toolMessages = [];

      for (const call of calls) {
        if (!isFunctionToolCall(call)) {
          continue;
        }

        const toolName = normalizeToolName(call.function.name);

        try {
          const args = parseReadFileArgs(call.function.arguments || "{}");
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
    const message = error instanceof Error ? error.message : String(error);
    yield { type: "done", answer: `Agent failed: ${message}` };
  }
}
