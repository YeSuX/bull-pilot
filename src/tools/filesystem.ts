import { dirname, relative, resolve } from "node:path";
import { realpath } from "node:fs/promises";

const WORKSPACE_ROOT = process.cwd();

function isInsideWorkspace(targetPath: string): boolean {
  const rel = relative(WORKSPACE_ROOT, targetPath);
  return rel.length > 0 && !rel.startsWith("..") && !rel.startsWith("/");
}

export async function resolveWorkspaceFilePath(path: string, ensureParent: boolean): Promise<string> {
  const absoluteTarget = resolve(WORKSPACE_ROOT, path);
  if (!isInsideWorkspace(absoluteTarget) && absoluteTarget !== WORKSPACE_ROOT) {
    throw new Error(`Path is outside workspace: ${path}`);
  }

  if (ensureParent) {
    const parent = dirname(absoluteTarget);
    const realParent = await realpath(parent).catch(() => parent);
    if (!isInsideWorkspace(realParent) && realParent !== WORKSPACE_ROOT) {
      throw new Error(`Parent path is outside workspace: ${path}`);
    }
  } else {
    const realTarget = await realpath(absoluteTarget).catch(() => absoluteTarget);
    if (!isInsideWorkspace(realTarget) && realTarget !== WORKSPACE_ROOT) {
      throw new Error(`Path resolves outside workspace: ${path}`);
    }
  }

  return absoluteTarget;
}
