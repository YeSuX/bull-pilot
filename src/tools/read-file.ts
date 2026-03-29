import type OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { resolveWorkspaceFilePath } from "./filesystem";

export type ReadFileArgs = {
  path: string;
};

export type ReadFileResult = {
  data: {
    path: string;
    content: string;
  };
};

export const readFileTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "read_file",
    description: "Read a local text file and return content",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path"
        }
      },
      required: ["path"],
      additionalProperties: false
    }
  }
};

export function parseReadFileArgs(rawArguments: string): ReadFileArgs {
  const parsed = JSON.parse(rawArguments) as { path?: string };

  if (!parsed.path || typeof parsed.path !== "string") {
    throw new Error("Invalid read_file arguments: path is required");
  }

  return { path: parsed.path };
}

export async function runReadFile(args: ReadFileArgs): Promise<ReadFileResult> {
  try {
    const target = await resolveWorkspaceFilePath(args.path, false);
    const content = await readFile(target, "utf-8");
    return {
      data: {
        path: args.path,
        content
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read file "${args.path}": ${message}`);
  }
}
