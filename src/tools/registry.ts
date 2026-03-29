import { parseReadFileArgs, readFileTool, runReadFile, type ReadFileArgs, type ReadFileResult } from "./read-file";
import {
  parseWriteFileArgs,
  runWriteFile,
  writeFileTool,
  type WriteFileArgs,
  type WriteFileResult
} from "./write-file";

export const tools = [readFileTool, writeFileTool];

export type ToolName = "read_file" | "write_file";

export type ToolPolicy = {
  name: ToolName;
  requiresApproval: boolean;
};

export const toolPolicies: ToolPolicy[] = [
  { name: "read_file", requiresApproval: false },
  { name: "write_file", requiresApproval: true }
];

export type ToolArgs = ReadFileArgs | WriteFileArgs;
export type ToolResult = ReadFileResult | WriteFileResult;

export type ToolExecutionSuccess = {
  toolName: ToolName;
  result: ToolResult;
};

export function normalizeToolName(name: string): ToolName {
  if (name !== "read_file" && name !== "write_file") {
    throw new Error(`Unknown tool: ${name}`);
  }

  return name;
}

export function parseToolArgs(name: ToolName, rawArguments: string): ToolArgs {
  if (name === "read_file") {
    return parseReadFileArgs(rawArguments);
  }

  return parseWriteFileArgs(rawArguments);
}

export function requiresApproval(name: ToolName): boolean {
  const policy = toolPolicies.find((item) => item.name === name);
  return policy ? policy.requiresApproval : true;
}

export async function executeTool(name: ToolName, args: ToolArgs): Promise<ToolExecutionSuccess> {
  if (name === "read_file") {
    const result = await runReadFile(args as ReadFileArgs);
    return {
      toolName: name,
      result
    };
  }

  const result = await runWriteFile(args as WriteFileArgs);

  return {
    toolName: name,
    result
  };
}
