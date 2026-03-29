# Bull Pilot V1 实施计划：从最小闭环到可用终端产品

## 1. 目标与范围

基于当前 V0（`src/index.ts` + `runAgent` + `read_file`）升级到 V1，目标是把 Agent 从“一次性命令”升级为“可长期使用的终端应用”。

V1 目标能力：

1. 多轮会话 REPL（持续输入，不必每次重启进程）
2. 控制器化状态管理（应用状态 + 执行状态）
3. 输入历史持久化（上下历史 + 去重）
4. 模型配置流（`/model` 命令内完成模型切换）
5. 工具审批机制（写操作前确认）
6. 统一事件渲染和调试输出
7. 取消执行与错误收敛

## 2. 与当前代码的差距

当前代码现状（V0）：

1. 单次 `Query>` 输入后结束，缺少会话循环
2. 只有运行时事件，没有应用状态机
3. 没有输入历史落盘
4. 模型配置仅依赖 `.env`
5. 没有审批层（仅单读工具）
6. 没有 debug 面板和分级日志

V1 核心思想：不推倒重来，先把“控制层 + 持久化 + 安全层”叠加到现有 Agent 内核上。

## 3. V1 架构设计

## 3.1 分层

```text
src/
  app/
    run-app.ts                 # REPL 主循环（应用编排）
    commands.ts                # /model /help /history /exit
  controllers/
    agent-runner.ts            # 运行状态机 + 事件聚合 + 中断
    model-selection.ts         # 模型选择状态机
    input-history.ts           # 输入历史持久化与导航
    approval.ts                # 工具审批状态与策略
  storage/
    settings-store.ts          # .bull-pilot/settings.json
    history-store.ts           # .bull-pilot/messages/history.json
  ui/
    renderer.ts                # 统一终端渲染（含工具事件摘要）
    working-indicator.ts       # idle/thinking/tool/approval
  agent/
    run-agent.ts               # 复用并扩展（审批/中断/事件）
    types.ts
  tools/
    registry.ts                # 增加工具元信息（是否需要审批）
```

## 3.2 状态机

应用状态 `AppState`：

1. `idle`
2. `model_select`
3. `api_key_input`
4. `running`
5. `approval`

执行状态 `WorkingState`：

1. `idle`
2. `thinking`
3. `tool`
4. `approval`

## 4. 里程碑计划

## M1：会话化与控制器骨架

1. 引入 `runApp()` REPL 循环
2. 新建 `AgentRunnerController`
3. 支持多轮输入与 `/exit`

验收：单进程内可连续提问 5 次以上，状态稳定。

## M2：输入历史与设置持久化

1. 增加 `HistoryStore`（JSON 持久化）
2. 增加 `SettingsStore`（模型配置持久化）
3. 增加 `/history`、`/model` 命令

验收：重启后历史和模型配置仍可读取。

## M3：审批层与工具治理

1. 为工具注册表增加 `requiresApproval`
2. 增加 `ApprovalController`
3. 在工具执行前触发审批流（allow-once / allow-session / deny）

验收：被标记工具必经审批，`deny` 可阻断本轮。

## M4：渲染、调试与可观测

1. 统一事件渲染器（工具摘要、错误摘要）
2. 增加 `logger`（debug/info/warn/error）
3. 增加工作状态提示（thinking/tool/approval）

验收：一次完整任务可观察到清晰阶段切换和关键日志。

## M5：取消、容错、回归测试

1. 支持 `/cancel` 中断当前运行
2. 统一异常收敛为用户可读消息
3. 增加 controller 层单测与集成 smoke test

验收：运行中可中断；异常不崩进程。

## 5. 详细 TODO 清单

### Phase 0：基础约束（已完成）

- [x] 固定 V1 范围：先实现 REPL 产品化，不引入完整 TUI 框架。
- [x] 新增目录：`src/app`、`src/controllers`、`src/storage`、`src/ui`。
- [x] 定义 `.bull-pilot` 持久化路径约定。

### Phase 1：应用主循环（已完成）

- [x] 新建 `run-app.ts` 并替换当前一次性入口。
- [x] 支持命令路由：普通 query 与 `/xxx` 命令。
- [x] 支持 `/help`、`/exit`。
- [x] 将 `index.ts` 改为仅启动 `runApp()`。

### Phase 2：控制器化（已完成）

- [x] 新建 `AgentRunnerController`：封装 `runAgent` 调用、事件消费、运行锁。
- [x] 新建 `ModelSelectionController`：封装模型读取与更新。
- [x] 将 `src/index.ts` 中的流程逻辑迁移到控制器。

### Phase 3：持久化（已完成）

- [x] 新建 `settings-store.ts`（读写 `provider/modelId`）。
- [x] 新建 `history-store.ts`（读写 query/answer，去重）。
- [x] 在每轮 `done` 后持久化对话记录。
- [x] 增加 `/history` 命令读取最近 N 条。

### Phase 4：审批与安全（已完成）

- [x] 扩展 `tools/registry.ts`，为每个工具声明元信息。
- [x] 新建 `ApprovalController` 维护 `allow-session`。
- [x] 在工具执行前插入审批检查。
- [x] `deny` 时返回 `tool_error` + `done` 收敛提示。

### Phase 5：渲染与日志（已完成）

- [x] 新建 `ui/renderer.ts`，统一格式化 `AgentEvent`。
- [x] 新建 `utils/logger.ts` 并支持日志级别。
- [x] 输出工具调用摘要（工具名、关键参数、耗时）。
- [x] 限制超长错误和参数输出长度，避免终端刷屏。

### Phase 6：中断与稳定性（已完成）

- [x] 新增 `AbortController` 贯穿 query 生命周期。
- [x] 增加 `/cancel` 命令取消执行。
- [x] 若审批等待中执行 `/cancel`，等价 `deny`。
- [x] 保证取消后状态回到 `idle`。

### Phase 7：测试与文档（已完成）

- [x] 增加 `controllers` 单元测试（状态转移）。
- [x] 增加工具审批集成测试。
- [x] 增加 REPL smoke test（mock LLM）。
- [x] 更新 README（命令、配置、已知限制）。

## 6. 关键数据结构（V1）

```ts
// src/controllers/types.ts
export type AppState = "idle" | "model_select" | "api_key_input" | "running" | "approval";

export type WorkingState = "idle" | "thinking" | "tool" | "approval";

export type ChatRecord = {
  id: string;
  query: string;
  answer: string;
  createdAt: string;
};

export type ModelSettings = {
  provider: "openai-compatible";
  modelId: string;
};
```

## 7. 关键实现片段

## 7.1 App 主循环（REPL）

```ts
// src/app/run-app.ts
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { AgentRunnerController } from "../controllers/agent-runner";
import { handleCommand } from "./commands";

export async function runApp(controller: AgentRunnerController): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  while (true) {
    const raw = await rl.question("bull-pilot> ");
    const input = raw.trim();

    if (input.length === 0) {
      continue;
    }

    if (input.startsWith("/")) {
      const shouldExit = await handleCommand(input, controller);
      if (shouldExit) {
        break;
      }
      continue;
    }

    await controller.runQuery(input);
  }

  rl.close();
}
```

## 7.2 AgentRunnerController（事件聚合 + 状态机）

```ts
// src/controllers/agent-runner.ts
import type OpenAI from "openai";
import { runAgent } from "../agent/run-agent";
import type { AgentEvent } from "../agent/types";
import { renderEvent } from "../ui/renderer";

export class AgentRunnerController {
  private workingState: "idle" | "thinking" | "tool" | "approval" = "idle";
  private abortController: AbortController | null = null;

  public constructor(
    private readonly client: OpenAI,
    private readonly modelId: () => string
  ) {}

  public getWorkingState(): string {
    return this.workingState;
  }

  public async runQuery(query: string): Promise<void> {
    if (this.abortController) {
      throw new Error("Another query is still running");
    }

    this.abortController = new AbortController();

    try {
      for await (const event of runAgent(this.client, this.modelId(), query, 3)) {
        this.workingState = this.mapEventToState(event);
        renderEvent(event);
      }
    } finally {
      this.abortController = null;
      this.workingState = "idle";
    }
  }

  public cancel(): void {
    this.abortController?.abort();
  }

  private mapEventToState(event: AgentEvent): "idle" | "thinking" | "tool" | "approval" {
    if (event.type === "thinking") {
      return "thinking";
    }
    if (event.type === "tool_start") {
      return "tool";
    }
    if (event.type === "done") {
      return "idle";
    }
    return this.workingState;
  }
}
```

## 7.3 设置与历史持久化

```ts
// src/storage/settings-store.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ModelSettings = {
  provider: "openai-compatible";
  modelId: string;
};

const SETTINGS_PATH = join(homedir(), ".bull-pilot", "settings.json");

export async function loadSettings(): Promise<ModelSettings | null> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ModelSettings;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: ModelSettings): Promise<void> {
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
```

```ts
// src/storage/history-store.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ChatRecord = {
  id: string;
  query: string;
  answer: string;
  createdAt: string;
};

const HISTORY_PATH = join(homedir(), ".bull-pilot", "messages", "history.json");

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

export async function loadHistory(): Promise<ChatRecord[]> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return JSON.parse(raw) as ChatRecord[];
  } catch {
    return [];
  }
}
```

## 7.4 工具审批扩展

```ts
// src/tools/registry.ts
export type ToolPolicy = {
  name: "read_file" | "write_file";
  requiresApproval: boolean;
};

export const toolPolicies: ToolPolicy[] = [
  { name: "read_file", requiresApproval: false },
  { name: "write_file", requiresApproval: true }
];

export function requiresApproval(name: string): boolean {
  const policy = toolPolicies.find((item) => item.name === name);
  return policy ? policy.requiresApproval : true;
}
```

```ts
// src/controllers/approval.ts
export type ApprovalDecision = "allow-once" | "allow-session" | "deny";

export class ApprovalController {
  private readonly sessionAllowSet = new Set<string>();

  public shouldAsk(toolName: string): boolean {
    return !this.sessionAllowSet.has(toolName);
  }

  public apply(toolName: string, decision: ApprovalDecision): void {
    if (decision === "allow-session") {
      this.sessionAllowSet.add(toolName);
    }
  }
}
```

## 7.5 统一事件渲染

```ts
// src/ui/renderer.ts
import type { AgentEvent } from "../agent/types";

export function renderEvent(event: AgentEvent): void {
  if (event.type === "thinking") {
    console.log(`[thinking] ${event.message}`);
    return;
  }

  if (event.type === "tool_start") {
    console.log(`[tool_start] ${event.name} ${JSON.stringify(event.input)}`);
    return;
  }

  if (event.type === "tool_end") {
    const size = event.output.data.content.length;
    console.log(`[tool_end] ${event.name} content_length=${size}`);
    return;
  }

  if (event.type === "tool_error") {
    console.log(`[tool_error] ${event.name}: ${event.error.slice(0, 240)}`);
    return;
  }

  console.log(`\nFinal Answer:\n${event.answer}`);
}
```

## 8. 命令设计（V1）

建议内建命令：

1. `/help`：显示命令说明
2. `/model`：查看或切换当前模型
3. `/history [n]`：查看最近 n 条历史
4. `/cancel`：取消当前运行任务
5. `/exit`：退出

## 9. 验收标准（DoD）

1. 支持连续会话（无需重启进程）
2. 状态切换可见（`idle/thinking/tool/approval`）
3. 历史与模型配置可持久化并在重启后恢复
4. 审批工具可阻断，`deny` 不会导致进程崩溃
5. 取消执行后系统回到 `idle`
6. `bun run typecheck` 与测试命令通过

## 10. 风险与规避

1. 命令路由与普通 query 混淆  
规避：统一以 `/` 前缀识别命令。

2. 持久化文件损坏导致启动失败  
规避：加载失败回退默认值，不阻断启动。

3. 审批流程阻塞主循环  
规避：审批控制器与运行控制器解耦，审批超时或拒绝自动收敛。

4. 多次并发提交导致状态错乱  
规避：`AgentRunnerController` 增加运行锁和并发保护。

## 11. V1 交付顺序建议

1. 先做 `M1 + M2`（先可用）
2. 再做 `M3`（安全）
3. 最后做 `M4 + M5`（可观测与稳定）

这样可以最快把产品体验从“可跑”提升为“可日常使用”。
