import { Box, Container, ProcessTerminal, Text, TUI } from "@mariozechner/pi-tui";
import type { AgentEvent } from "../agent/types";
import type { ApprovalDecision, WorkingState } from "../controllers/types";
import { t } from "../i18n";
import type { ToolName } from "../tools/registry";
import type { UiAdapter } from "./adapter";
import { ComposerView } from "./components/composer";
import { ChatLogView } from "./components/chat-log";
import { StatusBarView } from "./components/status-bar";
import { HelpPanelView } from "./components/help-panel";
import { ApprovalModal } from "./components/approval-modal";
import { formatEvent } from "./renderer";

class AsyncQueue {
  private items: string[] = [];
  private resolver: ((value: string) => void) | null = null;

  public push(value: string): void {
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      resolve(value);
      return;
    }

    this.items.push(value);
  }

  public async next(): Promise<string> {
    const value = this.items.shift();
    if (value !== undefined) {
      return value;
    }

    return await new Promise<string>((resolve) => {
      this.resolver = resolve;
    });
  }
}

export class TuiAdapter implements UiAdapter {
  private readonly terminal = new ProcessTerminal();
  private readonly tui = new TUI(this.terminal);
  private readonly queue = new AsyncQueue();
  private readonly chatLog = new ChatLogView();
  private readonly statusBar = new StatusBarView();
  private readonly helpPanel = new HelpPanelView();
  private readonly approvalModal = new ApprovalModal();
  private readonly title = new Text(`${t("appTitle")}  |  ${t("appSubtitle")}`);
  private readonly divider = new Text(t("divider"));
  private readonly composer: ComposerView;

  public constructor(private readonly getModelId: () => string) {
    this.composer = new ComposerView(
      (value: string) => {
        this.queue.push(value);
        this.tui.requestRender();
      },
      () => {
        this.queue.push("/cancel");
        this.tui.requestRender();
      }
    );

    const root = new Container();
    const helpBox = new Box(1, 0);
    helpBox.addChild(this.helpPanel.text);

    root.addChild(this.title);
    root.addChild(this.statusBar.text);
    root.addChild(this.divider);
    root.addChild(helpBox);
    root.addChild(new Text(t("divider")));
    root.addChild(this.chatLog.text);
    root.addChild(new Text(t("divider")));
    root.addChild(this.composer.input);

    this.helpPanel.setDefault();
    this.tui.addChild(root);
  }

  public async start(): Promise<void> {
    this.statusBar.set(this.getModelId(), "idle");
    this.tui.start();
    this.tui.setFocus(this.composer.input);
    this.info(t("uiModeTui"));
    this.info(t("cmdHelpTitle"));
    this.info([t("cmdHelpModel"), t("cmdHelpHistory"), t("cmdHelpCancel"), t("cmdLogs"), t("cmdHelpExit")].join(" | "));
  }

  public async close(): Promise<void> {
    this.tui.stop();
  }

  public async readInput(_prompt: string): Promise<string> {
    return await this.queue.next();
  }

  public info(message: string): void {
    this.chatLog.append([message, ""]);
    this.tui.requestRender();
  }

  public error(message: string): void {
    this.chatLog.append([`错误: ${message}`, ""]);
    this.tui.requestRender();
  }

  public renderState(state: WorkingState, modelId: string): void {
    this.statusBar.set(modelId, state);
    this.tui.requestRender();
  }

  public renderEvent(event: AgentEvent): void {
    if (event.type === "answer_start") {
      this.chatLog.startStream(formatEvent(event));
      this.tui.requestRender();
      return;
    }

    if (event.type === "answer_delta") {
      this.chatLog.appendStreamDelta(event.delta);
      this.tui.requestRender();
      return;
    }

    if (event.type === "answer_end") {
      this.chatLog.endStream();
      this.tui.requestRender();
      return;
    }

    this.chatLog.append(formatEvent(event));
    this.tui.requestRender();
  }

  public async requestApproval(toolName: ToolName, _argsRaw: string): Promise<ApprovalDecision> {
    this.chatLog.append([t("eventApprovalNeed", { tool: toolName }), t("approvePromptTitle")]);
    this.tui.requestRender();
    const decision = await this.approvalModal.open(this.tui, toolName);
    this.statusBar.set(this.getModelId(), "approval");
    this.chatLog.append([`审批: ${toolName} -> ${decision}`]);
    this.tui.setFocus(this.composer.input);
    this.tui.requestRender();
    return decision;
  }
}

export function createTuiAdapter(getModelId: () => string): UiAdapter {
  return new TuiAdapter(getModelId);
}
