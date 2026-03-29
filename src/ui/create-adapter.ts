import { t } from "../i18n";
import type { UiAdapter } from "./adapter";
import { createTuiAdapter } from "./app-shell";
import { PlainAdapter } from "./plain-adapter";

export type UiMode = "tui" | "plain";

export type UiOptions = {
  mode: UiMode;
  getModelId: () => string;
};

export function resolveUiMode(argv: string[], envMode: string | undefined, isTty: boolean): UiMode {
  if (argv.includes("--plain")) {
    return "plain";
  }

  if (envMode === "plain") {
    return "plain";
  }

  if (envMode === "tui") {
    return isTty ? "tui" : "plain";
  }

  return isTty ? "tui" : "plain";
}

export function createUiAdapter(options: UiOptions): UiAdapter {
  if (options.mode === "plain") {
    return new PlainAdapter();
  }

  try {
    return createTuiAdapter(options.getModelId);
  } catch {
    const fallback = new PlainAdapter();
    fallback.info(t("uiFallbackPlain"));
    return fallback;
  }
}
