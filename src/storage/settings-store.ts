import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ModelSettings } from "../controllers/types";
import { SETTINGS_PATH } from "./paths";

function isModelSettings(value: ModelSettings | null): value is ModelSettings {
  if (!value) {
    return false;
  }

  return value.provider === "openai-compatible" && value.modelId.length > 0;
}

export async function loadSettings(): Promise<ModelSettings | null> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ModelSettings;
    return isModelSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: ModelSettings): Promise<void> {
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
