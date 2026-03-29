import { Text } from "@mariozechner/pi-tui";
import { t } from "../../i18n";

export class HelpPanelView {
  public readonly text: Text;

  public constructor() {
    this.text = new Text("");
  }

  public setDefault(): void {
    this.text.setText([
      t("cmdHelpTitle"),
      t("cmdHelpModel"),
      t("cmdHelpHistory"),
      t("cmdHelpCancel"),
      t("cmdLogs"),
      t("cmdHelpExit")
    ].join("\n"));
  }
}
