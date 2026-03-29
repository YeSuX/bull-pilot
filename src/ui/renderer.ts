import type { AgentEvent } from "../agent/types";
import { t } from "../i18n";

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength)}...`;
}

export function formatEvent(event: AgentEvent): string[] {
  if (event.type === "answer_start") {
    return [t("assistantAnswer"), t("finalAnswer")];
  }

  if (event.type === "answer_delta") {
    return [event.delta];
  }

  if (event.type === "answer_end") {
    return [""];
  }

  if (event.type === "thinking") {
    return [t("eventThinking", { message: event.message })];
  }

  if (event.type === "approval_request") {
    return [
      t("eventApprovalNeed", { tool: event.name }),
      t("approveHint")
    ];
  }

  if (event.type === "approval_result") {
    return [t("eventApprovalResult", { tool: event.name, decision: event.decision })];
  }

  if (event.type === "tool_start") {
    return [
      t("eventToolStart", {
        tool: event.name,
        input: truncate(JSON.stringify(event.input), 240)
      })
    ];
  }

  if (event.type === "tool_end") {
    if ("data" in event.output && "content" in event.output.data) {
      return [
        t("eventToolEndRead", {
          tool: event.name,
          size: String(event.output.data.content.length)
        })
      ];
    }

    if ("data" in event.output && "bytes" in event.output.data) {
      return [
        t("eventToolEndWrite", {
          tool: event.name,
          size: String(event.output.data.bytes)
        })
      ];
    }

    return [t("eventToolEnd", { tool: event.name })];
  }

  if (event.type === "tool_error") {
    return [
      t("eventToolError", {
        tool: event.name,
        error: truncate(event.error, 240)
      })
    ];
  }

  return [t("assistantAnswer"), t("finalAnswer"), event.answer];
}
