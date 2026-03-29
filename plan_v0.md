# Bull Pilot V0 实施计划：单轮工具调用 Agent 最小闭环（OpenAI Provider + Kimi）

## 1. 目标与范围

目标是实现并验证以下最小闭环：

1. 用户输入一个 query
2. 第一次模型调用返回至少一个 `tool_call`
3. Agent 执行工具并拿到结果
4. 第二次模型调用基于工具结果返回最终答案
5. 全过程通过事件流输出（`thinking -> tool_start -> tool_end -> done`）

V0 只做“跑通”，不做复杂能力（memory / skills / cron / 多工具并行 / UI）。

## 2. V0 非目标

1. 不做多轮长对话记忆
2. 不做工具审批系统
3. 不做复杂上下文裁剪
4. 不做 Web 搜索或外部 API 工具
5. 不做前端可视化，先用 CLI 事件日志验证

## 3. 技术选型

1. Runtime: Bun + TypeScript
2. LLM SDK: `openai` npm 包（走 OpenAI-compatible provider）
3. Provider: Kimi（通过 `baseURL` + `apiKey`）
4. V0 模型：`kimi-k2-0711-preview`（可配置，避免硬编码）

说明：只要 provider 兼容 Chat Completions 的 tools 接口，下面方案可直接复用。

## 4. 目录结构（建议）

```text
src/
  index.ts                 # CLI 入口
  agent/
    run-agent.ts           # 主循环（两次模型调用闭环）
    types.ts               # 事件、工具调用、上下文类型
  model/
    client.ts              # OpenAI provider 客户端初始化
  tools/
    read-file.ts           # 唯一工具（V0）
    registry.ts            # 工具注册与执行分发
```

## 5. 里程碑计划

## M1（半天）：基础骨架

1. 初始化 `openai` 依赖和环境变量读取
2. 建立事件类型和事件输出函数
3. 建立单工具 `read_file` 及注册表

验收：能在本地手动执行工具函数并返回 JSON。

## M2（半天）：首轮模型调用 + tool_call 解析

1. 发送用户 query + system prompt
2. 绑定 tools schema
3. 解析 `assistant.tool_calls`

验收：输入“读取 package.json 的 name/version”时，能拿到 `read_file` 的 tool_call。

## M3（半天）：工具执行 + 二轮收敛

1. 执行 tool_call，产出 `tool_start/tool_end`
2. 将工具结果注入第二次模型调用
3. 输出最终答案 `done`

验收：完整出现 `thinking -> tool_start -> tool_end -> done`。

## M4（半天）：稳定性补齐

1. 增加异常处理（模型错误、JSON 参数错误、文件不存在）
2. 增加最大迭代保护（V0 可设 2-3）
3. 增加最小日志，便于定位工具调用失败原因

验收：异常路径也会输出 `done(error message)`，不会卡死。

## 5.1 详细 TODO 清单（按阶段执行）

说明：以下为执行级任务列表，建议按顺序推进；每项完成后打勾。

### Phase 0：启动与约束确认（项目准备，已完成）

- [x] 确认 V0 范围：仅单轮工具闭环，不做 memory/skills/cron/UI。
- [x] 确认 provider 接入方式：`openai` SDK + `OPENAI_BASE_URL` 指向 Kimi。
- [x] 确认目标模型变量：`OPENAI_MODEL` 可配置，默认 `kimi-k2-0711-preview`。
- [x] 确认演示工具：只保留 `read_file`。
- [x] 确认演示 query：`读取 package.json 的 name 和 version`。

### Phase 1：工程骨架（对应 M1，已完成）

- [x] 安装依赖：`openai`、`dotenv`。
- [x] 建立目录：`src/model`、`src/tools`、`src/agent`。
- [x] 新建 `src/model/client.ts`。
- [x] 新建 `src/tools/read-file.ts`。
- [x] 新建 `src/tools/registry.ts`。
- [x] 新建 `src/agent/types.ts`。
- [x] 新建 `src/agent/run-agent.ts`。
- [x] 更新 `src/index.ts` 为 CLI 入口版本。
- [x] 本地创建 `.env`（仅本机，不提交密钥）。
- [x] 验证 TypeScript 无基础语法错误（可通过一次 `bun run` 触发编译检查）。

### Phase 2：首轮模型调用与工具决策（对应 M2，已完成）

- [x] 在 `client.ts` 实现 `createLlmClient()`，校验 `OPENAI_API_KEY`/`OPENAI_BASE_URL`。
- [x] 在 `client.ts` 实现 `getModelName()`，提供默认模型回退。
- [x] 在 `read-file.ts` 定义 `read_file` 的 tool schema（`name/description/parameters`）。
- [x] 在 `registry.ts` 暴露 `tools` 数组并接入 `read_file`。
- [x] 在 `run-agent.ts` 构建中文 `systemPrompt`。
- [x] 在 `run-agent.ts` 发起第一轮 `chat.completions.create`（携带 `tools` + `tool_choice:auto`）。
- [x] 解析首轮返回中的 `assistant.tool_calls`。
- [x] 增加“无工具调用直接结束”的分支（`done`）。

### Phase 3：工具执行与二轮收敛（对应 M3，已完成）

- [x] 在 `types.ts` 定义事件类型：`thinking/tool_start/tool_end/tool_error/done`。
- [x] 在 `run-agent.ts` 实现 `thinking` 事件发射。
- [x] 在 `run-agent.ts` 循环处理每个 `tool_call`。
- [x] 解析 `tool_call.function.arguments`（JSON.parse）。
- [x] 在工具执行前发射 `tool_start`。
- [x] 通过 `executeTool()` 执行工具并拿到结构化结果。
- [x] 在工具成功后发射 `tool_end`。
- [x] 在工具异常时发射 `tool_error` 并构造 error 型 tool message。
- [x] 构造第二轮消息序列：`system -> user -> assistant(tool_calls) -> tool(...)`。
- [x] 发起第二轮模型调用并输出 `done(final answer)`。
- [x] 在 `index.ts` 按事件流打印日志，便于观察闭环。

### Phase 4：健壮性与边界（对应 M4，已完成）

- [x] 给 `JSON.parse` 增加保护，避免参数非法导致进程中断。
- [x] 给 `executeTool` 增加未知工具错误提示。
- [x] 给 `read_file` 的文件不存在/无权限异常提供可读错误信息。
- [x] 给模型调用增加统一异常捕获并收敛到 `done(error message)`。
- [x] 增加最大迭代保护参数（V0 默认 2 或 3）。
- [x] 增加最小诊断日志：记录本轮是否触发工具、工具名、失败原因。

### Phase 5：联调验证与验收（已完成）

- [x] 用标准 query 跑通一次完整闭环。
- [x] 确认日志顺序包含：`thinking -> tool_start -> tool_end -> done`。
- [x] 人工核对最终答案确实来自 `package.json` 内容，而非模型猜测。
- [x] 运行一个错误样例（如不存在路径）验证 `tool_error` 分支。
- [x] 验证异常样例仍会输出 `done`，不会卡死或直接崩溃。
- [x] 对照“第 9 节 DoD”逐项打勾。

### Phase 6：交付物整理（仅文档与说明，已完成）

- [x] 更新 README 的运行说明（环境变量 + 启动命令 + 示例 query）。
- [x] 补充“已知限制”说明（仅单工具、无多轮记忆、无审批）。
- [x] 记录后续演进入口（对应第 11 节 V1 方向）。

## 6. 环境变量

新增 `.env`（本地）：

```bash
OPENAI_API_KEY=your_kimi_key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2-0711-preview
```

如果你后续切模型，只改 `OPENAI_MODEL`。

## 7. 关键代码片段

## 7.1 OpenAI provider 客户端

```ts
// src/model/client.ts
import OpenAI from "openai";

// 初始化 OpenAI 兼容客户端（用于接入 Kimi）
export function createLlmClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  if (!baseURL) throw new Error("Missing OPENAI_BASE_URL");

  return new OpenAI({ apiKey, baseURL });
}

// 读取模型名，未配置时回退到默认 Kimi 模型
export function getModelName() {
  return process.env.OPENAI_MODEL || "kimi-k2-0711-preview";
}
```

## 7.2 工具定义与执行

```ts
// src/tools/read-file.ts
import { readFile } from "node:fs/promises";

export const readFileTool = {
  type: "function" as const,
  function: {
    name: "read_file",
    description: "Read a local text file and return content",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
};

export async function runReadFile(args: { path: string }) {
  // 读取本地文件内容并以统一结构返回，便于二轮模型消费
  const content = await readFile(args.path, "utf-8");
  return {
    data: {
      path: args.path,
      content,
    },
  };
}
```

```ts
// src/tools/registry.ts
import { readFileTool, runReadFile } from "./read-file";

export const tools = [readFileTool];

export async function executeTool(name: string, args: unknown) {
  // V0 只支持 read_file，一个分支即可形成最小闭环
  if (name === "read_file") {
    const input = args as { path: string };
    return runReadFile(input);
  }
  throw new Error(`Unknown tool: ${name}`);
}
```

## 7.3 事件类型

```ts
// src/agent/types.ts
export type AgentEvent =
  | { type: "thinking"; message: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: unknown }
  | { type: "tool_error"; name: string; error: string }
  | { type: "done"; answer: string };
```

## 7.4 Agent 主循环（最小闭环）

```ts
// src/agent/run-agent.ts
import type OpenAI from "openai";
import { tools, executeTool } from "../tools/registry";
import type { AgentEvent } from "./types";

export async function* runAgent(
  client: OpenAI,
  model: string,
  query: string,
): AsyncGenerator<AgentEvent> {
  // 告知 CLI：当前进入思考阶段
  yield { type: "thinking", message: "Analyzing query" };

  const systemPrompt = [
    "你是一个 CLI Agent。",
    "当问题需要外部数据时，优先调用工具。",
    "拿到足够工具结果后，直接给出最终答案，不要继续调用工具。",
  ].join(" ");

  // 第一轮：让模型决定是否发起工具调用
  const first = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    tools,
    tool_choice: "auto",
  });

  const assistant = first.choices[0]?.message;
  const calls = assistant?.tool_calls || [];

  if (calls.length === 0) {
    yield { type: "done", answer: assistant?.content || "No answer" };
    return;
  }

  const toolMessages: Array<{
    role: "tool";
    tool_call_id: string;
    content: string;
  }> = [];

  for (const call of calls) {
    const name = call.function.name;
    let args: unknown = {};

    try {
      // 执行模型返回的工具调用，并把结果回填为 tool 消息
      args = JSON.parse(call.function.arguments || "{}");
      yield { type: "tool_start", name, input: args };
      const output = await executeTool(name, args);
      yield { type: "tool_end", name, output };

      toolMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      yield { type: "tool_error", name, error };
      toolMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ error }),
      });
    }
  }

  // 第二轮：把工具结果交给模型进行收敛回答
  const second = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
      {
        role: "assistant",
        content: assistant?.content || "",
        tool_calls: calls,
      },
      ...toolMessages,
    ],
  });

  const finalText = second.choices[0]?.message?.content || "No final answer";
  yield { type: "done", answer: finalText };
}
```

## 7.5 CLI 入口

```ts
// src/index.ts
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createLlmClient, getModelName } from "./model/client";
import { runAgent } from "./agent/run-agent";

async function main() {
  // 从命令行读取用户问题
  const rl = createInterface({ input: stdin, output: stdout });
  const query = await rl.question("Query> ");
  rl.close();

  const client = createLlmClient();
  const model = getModelName();

  // 按事件流打印运行过程，方便观察最小闭环
  for await (const event of runAgent(client, model, query)) {
    if (event.type === "thinking") {
      console.log(`[thinking] ${event.message}`);
    } else if (event.type === "tool_start") {
      console.log(`[tool_start] ${event.name}`, event.input);
    } else if (event.type === "tool_end") {
      console.log(`[tool_end] ${event.name}`);
    } else if (event.type === "tool_error") {
      console.log(`[tool_error] ${event.name}: ${event.error}`);
    } else if (event.type === "done") {
      console.log(`\nFinal Answer:\n${event.answer}`);
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
```

## 8. 运行与验证

1. 安装依赖：`bun add openai dotenv`
2. 运行：`bun run src/index.ts`
3. 输入：`读取 package.json 的 name 和 version`

预期日志顺序：

1. `[thinking] ...`
2. `[tool_start] read_file ...`
3. `[tool_end] read_file`
4. `Final Answer: ...`

## 9. 验收标准（Definition of Done）

1. 至少 1 个 query 稳定触发一次工具调用
2. 工具结果被注入第二次模型调用，并影响最终答案
3. CLI 能看到完整事件链
4. 工具失败时不崩溃，仍输出 `done`

## 10. 风险与规避

1. 模型不触发工具调用
   规避：system prompt 明确 “需要文件内容时必须调用 `read_file`”。

2. `tool_calls.arguments` 非法 JSON
   规避：`try/catch + tool_error + 回填 error 到 tool message`。

3. Provider 差异导致字段兼容问题
   规避：先用最小字段集（`model/messages/tools/tool_choice`），避免一次上太多高级参数。

4. 上下文拼接错误导致二轮失败
   规避：严格按 `assistant(tool_calls) -> tool(role=tool)` 顺序追加消息。

## 11. V1 演进方向（V0 跑通后）

1. 引入 `scratchpad` JSONL 持久化工具结果
2. 增加 `maxIterations` 与上下文裁剪
3. 加入工具审批（写操作）
4. 工具并发执行与超时控制
5. 从 CLI 事件升级为 UI 卡片

---

以上方案和你 `research_v0.md` 的结论一致：先保留 Agent 主循环 + `callLlm(bindTools)` + 单工具 + 核心事件，再逐层扩展复杂能力。这是最稳的 V0 落地路径。
