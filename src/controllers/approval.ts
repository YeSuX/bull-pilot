import type { ApprovalDecision } from "./types";
import type { ToolName } from "../tools/registry";

export class ApprovalController {
  private readonly sessionAllowSet = new Set<ToolName>();

  public isSessionAllowed(toolName: ToolName): boolean {
    return this.sessionAllowSet.has(toolName);
  }

  public apply(toolName: ToolName, decision: ApprovalDecision): void {
    if (decision === "allow-session") {
      this.sessionAllowSet.add(toolName);
    }
  }

  public resetSession(): void {
    this.sessionAllowSet.clear();
  }
}
