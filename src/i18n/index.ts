import { zhCN, type ZhCNKey } from "./zh-cn";

export function t(key: ZhCNKey, params: Record<string, string> = {}): string {
  let output: string = zhCN[key];
  for (const [paramKey, value] of Object.entries(params)) {
    output = output.replace(`{${paramKey}}`, value);
  }
  return output;
}
