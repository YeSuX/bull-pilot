import { Text } from "@mariozechner/pi-tui";

export class ChatLogView {
  private readonly lines: string[] = [];
  private readonly maxLines: number;
  private streamingLine: string | null = null;
  public readonly text: Text;

  public constructor(maxLines: number = 400) {
    this.maxLines = maxLines;
    this.text = new Text("");
  }

  public append(lines: string[]): void {
    this.lines.push(...lines);
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }
    this.refresh();
  }

  public startStream(prefixLines: string[]): void {
    this.lines.push(...prefixLines);
    this.streamingLine = "";
    this.refresh();
  }

  public appendStreamDelta(delta: string): void {
    if (this.streamingLine === null) {
      this.streamingLine = "";
    }
    this.streamingLine += delta;
    this.refresh();
  }

  public endStream(): void {
    if (this.streamingLine !== null) {
      this.lines.push(this.streamingLine);
      this.streamingLine = null;
    }
    this.lines.push("");
    this.refresh();
  }

  private refresh(): void {
    const output = this.streamingLine === null ? this.lines : [...this.lines, this.streamingLine];
    this.text.setText(output.join("\n"));
  }
}
