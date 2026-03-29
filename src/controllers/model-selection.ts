import type { ModelSettings } from "./types";
import { loadSettings, saveSettings } from "../storage/settings-store";

export class ModelSelectionController {
  private settings: ModelSettings = {
    provider: "openai-compatible",
    modelId: process.env.OPENAI_MODEL || "kimi-k2-0711-preview"
  };

  public async init(): Promise<void> {
    const stored = await loadSettings();
    if (stored) {
      this.settings = stored;
    }
  }

  public getSettings(): ModelSettings {
    return this.settings;
  }

  public getModelId(): string {
    return this.settings.modelId;
  }

  public async setModelId(modelId: string): Promise<void> {
    const normalized = modelId.trim();
    if (normalized.length === 0) {
      throw new Error("Model id cannot be empty");
    }

    this.settings = {
      provider: "openai-compatible",
      modelId: normalized
    };
    await saveSettings(this.settings);
  }
}
