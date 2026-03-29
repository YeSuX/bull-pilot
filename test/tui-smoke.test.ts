import { describe, expect, test } from "bun:test";
import { ChatLogView } from "../src/ui/components/chat-log";
import { StatusBarView } from "../src/ui/components/status-bar";
import { HelpPanelView } from "../src/ui/components/help-panel";
import { ComposerView } from "../src/ui/components/composer";

describe("tui smoke", () => {
  test("core components render", () => {
    const chat = new ChatLogView();
    chat.append(["第一行", "第二行"]);

    const status = new StatusBarView();
    status.set("kimi-k2.5", "thinking");

    const help = new HelpPanelView();
    help.setDefault();

    const composer = new ComposerView(() => {}, () => {});

    expect(chat.text.render(80).length).toBeGreaterThan(0);
    expect(status.text.render(80).length).toBeGreaterThan(0);
    expect(help.text.render(80).length).toBeGreaterThan(0);
    expect(composer.input.render(80).length).toBeGreaterThan(0);
  });
});
