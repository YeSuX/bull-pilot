import type { WorkingState } from "../controllers/types";
import { t } from "../i18n";

export function stateToLabel(state: WorkingState): string {
  if (state === "thinking") {
    return t("stateThinking");
  }

  if (state === "tool") {
    return t("stateTool");
  }

  if (state === "approval") {
    return t("stateApproval");
  }

  return t("stateIdle");
}
