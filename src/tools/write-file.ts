import type OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveWorkspaceFilePath } from "./filesystem";

export type WriteFileArgs = {
  path: string;
  content: string;
};

export type WriteFileResult = {
  data: {
    path: string;
    bytes: number;
  };
};

export const writeFileTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "write_file",
    description: "Write text content to a local file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path"
        },
        content: {
          type: "string",
          description: "Text content to write"
        }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  }
};

export function parseWriteFileArgs(rawArguments: string): WriteFileArgs {
  const parsed = JSON.parse(rawArguments) as { path?: string; content?: string };

  if (!parsed.path || typeof parsed.path !== "string") {
    throw new Error("Invalid write_file arguments: path is required");
  }

  if (typeof parsed.content !== "string") {
    throw new Error("Invalid write_file arguments: content is required");
  }

  return { path: parsed.path, content: parsed.content };
}

export async function runWriteFile(args: WriteFileArgs): Promise<WriteFileResult> {
  try {
    const target = await resolveWorkspaceFilePath(args.path, true);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, args.content, "utf-8");
    return {
      data: {
        path: args.path,
        bytes: Buffer.byteLength(args.content, "utf-8")
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write file "${args.path}": ${message}`);
  }
}
