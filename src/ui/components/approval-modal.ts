import { Container, SelectList, type OverlayHandle, type SelectItem, type SelectListTheme } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import type { ApprovalDecision } from "../../controllers/types";
import { t } from "../../i18n";

const theme: SelectListTheme = {
  selectedPrefix: (text: string) => text,
  selectedText: (text: string) => `> ${text}`,
  description: (text: string) => text,
  scrollInfo: (text: string) => text,
  noMatch: (text: string) => text
};

function toDecision(value: string): ApprovalDecision {
  if (value === "allow-once" || value === "allow-session" || value === "deny") {
    return value;
  }

  return "deny";
}

export class ApprovalModal {
  public async open(tui: TUI, toolName: string): Promise<ApprovalDecision> {
    const items: SelectItem[] = [
      { value: "allow-once", label: t("approveAllowOnce"), description: toolName },
      { value: "allow-session", label: t("approveAllowSession"), description: toolName },
      { value: "deny", label: t("approveDeny"), description: toolName }
    ];

    const container = new Container();
    const list = new SelectList(items, 6, theme);
    container.addChild(list);

    const overlay: OverlayHandle = tui.showOverlay(container, {
      anchor: "bottom-center",
      offsetY: -2,
      width: "90%",
      maxHeight: 8
    });

    tui.setFocus(list);

    return await new Promise<ApprovalDecision>((resolve) => {
      list.onSelect = (item) => {
        overlay.hide();
        resolve(toDecision(item.value));
      };

      list.onCancel = () => {
        overlay.hide();
        resolve("deny");
      };
    });
  }
}
