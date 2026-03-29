export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  at: string;
};

const MAX_LOGS = 50;

class Logger {
  private readonly entries: LogEntry[] = [];

  public log(level: LogLevel, message: string): void {
    this.entries.push({
      level,
      message,
      at: new Date().toISOString()
    });

    if (this.entries.length > MAX_LOGS) {
      this.entries.splice(0, this.entries.length - MAX_LOGS);
    }
  }

  public debug(message: string): void {
    this.log("debug", message);
  }

  public info(message: string): void {
    this.log("info", message);
  }

  public warn(message: string): void {
    this.log("warn", message);
  }

  public error(message: string): void {
    this.log("error", message);
  }

  public getRecent(): LogEntry[] {
    return [...this.entries];
  }
}

export const logger = new Logger();
