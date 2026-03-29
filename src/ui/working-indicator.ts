import type { WorkingState } from "../controllers/types";

export function renderWorkingState(state: WorkingState): void {
  if (state === "idle") {
    return;
  }

  console.log(`[state] ${state}`);
}
