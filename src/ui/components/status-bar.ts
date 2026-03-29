import { Text } from "@mariozechner/pi-tui";
import { stateToLabel } from "../working-indicator";
import type { WorkingState } from "../../controllers/types";

export class StatusBarView {
  public readonly text: Text;

  public constructor() {
    this.text = new Text("");
  }

  public set(modelId: string, state: WorkingState): void {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    this.text.setText(`模型: ${modelId} | 状态: ${stateToLabel(state)} | 时间: ${time}`);
  }
}
