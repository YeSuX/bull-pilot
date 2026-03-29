import { describe, expect, test } from "bun:test";
import { zhCN } from "../src/i18n/zh-cn";

const requiredKeys = [
  "cmdHelpTitle",
  "cmdUnknown",
  "stateThinking",
  "stateTool",
  "stateApproval",
  "stateIdle",
  "finalAnswer",
  "runInterrupted",
  "approvalDeniedByUser"
] as const;

describe("i18n completeness", () => {
  test("required keys exist and are non-empty", () => {
    for (const key of requiredKeys) {
      expect(zhCN[key].length).toBeGreaterThan(0);
    }
  });
});
