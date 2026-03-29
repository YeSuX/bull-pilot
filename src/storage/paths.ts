import { join } from "node:path";

const APP_DIR = join(process.cwd(), ".bull-pilot");

export const SETTINGS_PATH = join(APP_DIR, "settings.json");
export const HISTORY_PATH = join(APP_DIR, "messages", "history.json");
