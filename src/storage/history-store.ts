import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ChatRecord } from "../controllers/types";
import { HISTORY_PATH } from "./paths";

function isChatRecordList(value: ChatRecord[]): value is ChatRecord[] {
  return value.every((item) => {
    return (
      item.id.length > 0 &&
      item.query.length > 0 &&
      item.answer.length >= 0 &&
      item.createdAt.length > 0
    );
  });
}

export async function loadHistory(): Promise<ChatRecord[]> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ChatRecord[];
    return isChatRecordList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendHistory(record: ChatRecord): Promise<void> {
  const list = await loadHistory();
  const last = list.at(-1);

  if (last && last.query === record.query && last.answer === record.answer) {
    return;
  }

  list.push(record);
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(list, null, 2), "utf-8");
}
