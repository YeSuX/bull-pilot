import type { ChatRecord } from "./types";
import { appendHistory, loadHistory } from "../storage/history-store";

export class InputHistoryController {
  private records: ChatRecord[] = [];
  private cursor = -1;

  public async init(): Promise<void> {
    this.records = await loadHistory();
    this.cursor = this.records.length;
  }

  public async add(query: string, answer: string): Promise<void> {
    const record: ChatRecord = {
      id: crypto.randomUUID(),
      query,
      answer,
      createdAt: new Date().toISOString()
    };

    this.records.push(record);
    this.cursor = this.records.length;
    await appendHistory(record);
  }

  public getRecent(limit: number): ChatRecord[] {
    const safeLimit = limit > 0 ? limit : 10;
    return this.records.slice(-safeLimit);
  }

  public previousQuery(): string | null {
    if (this.records.length === 0) {
      return null;
    }

    this.cursor = Math.max(0, this.cursor - 1);
    return this.records[this.cursor]?.query ?? null;
  }

  public nextQuery(): string | null {
    if (this.records.length === 0) {
      return null;
    }

    this.cursor = Math.min(this.records.length, this.cursor + 1);
    if (this.cursor === this.records.length) {
      return "";
    }

    return this.records[this.cursor]?.query ?? null;
  }
}
