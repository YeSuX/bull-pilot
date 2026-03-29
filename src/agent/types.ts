import type { ApprovalDecision } from "../controllers/types";
import type { ToolArgs, ToolName, ToolResult } from "../tools/registry";

export type ThinkingEvent = {
  type: "thinking";
  message: string;
};

export type ToolStartEvent = {
  type: "tool_start";
  name: ToolName;
  input: ToolArgs;
};

export type ToolEndEvent = {
  type: "tool_end";
  name: ToolName;
  output: ToolResult;
};

export type ToolErrorEvent = {
  type: "tool_error";
  name: ToolName;
  error: string;
};

export type DoneEvent = {
  type: "done";
  answer: string;
};

export type ApprovalRequestEvent = {
  type: "approval_request";
  name: ToolName;
  input: ToolArgs;
};

export type ApprovalResultEvent = {
  type: "approval_result";
  name: ToolName;
  decision: ApprovalDecision;
};

export type AgentEvent =
  | ThinkingEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolErrorEvent
  | ApprovalRequestEvent
  | ApprovalResultEvent
  | DoneEvent;
