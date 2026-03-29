import { Input } from "@mariozechner/pi-tui";

type SubmitHandler = (value: string) => void;
type EscapeHandler = () => void;

export class ComposerView {
  public readonly input: Input;

  public constructor(onSubmit: SubmitHandler, onEscape: EscapeHandler) {
    this.input = new Input();
    this.input.onSubmit = (value: string) => {
      onSubmit(value);
      this.input.setValue("");
    };
    this.input.onEscape = onEscape;
  }
}
