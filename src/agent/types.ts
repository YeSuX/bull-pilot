import type { ReadFileArgs, ReadFileResult } from "../tools/read-file";
import type { ToolName } from "../tools/registry";

export type ThinkingEvent = {
  type: "thinking";
  message: string;
};

export type ToolStartEvent = {
  type: "tool_start";
  name: ToolName;
  input: ReadFileArgs;
};

export type ToolEndEvent = {
  type: "tool_end";
  name: ToolName;
  output: ReadFileResult;
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

export type AgentEvent = ThinkingEvent | ToolStartEvent | ToolEndEvent | ToolErrorEvent | DoneEvent;
