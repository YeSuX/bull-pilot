import { readFileTool, runReadFile, type ReadFileArgs, type ReadFileResult } from "./read-file";

export const tools = [readFileTool];

export type ToolName = "read_file";

export type ToolExecutionSuccess = {
  toolName: ToolName;
  result: ReadFileResult;
};

export function normalizeToolName(name: string): ToolName {
  if (name !== "read_file") {
    throw new Error(`Unknown tool: ${name}`);
  }

  return name;
}

export async function executeTool(name: ToolName, args: ReadFileArgs): Promise<ToolExecutionSuccess> {
  const result = await runReadFile(args);

  return {
    toolName: name,
    result
  };
}
