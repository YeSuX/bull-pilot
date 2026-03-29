# Bull Pilot V1.1 实施计划：中文化与终端交互升级

## 1. 目标

V1.1 只解决两类问题：

1. 所有面向用户的输出改为中文（日志、命令帮助、错误提示、审批提示、状态文案）
2. 将当前朴素 REPL 交互升级为更友好的第三方 TUI 终端界面

不在本阶段引入新工具能力或模型能力。

## 2. 范围与非目标

范围：

1. 文案国际化（先落地 `zh-CN`）
2. 事件渲染层重构（从 `console.log` 到 UI 组件）
3. 命令输入体验优化（历史、快捷键、状态提示）
4. 审批交互从文本命令改为可操作视图

非目标：

1. 不新增业务工具
2. 不重写 Agent 核心推理逻辑
3. 不引入 Web 前端

## 3. 第三方库选型

## 3.1 候选库

1. `@mariozechner/pi-tui`
2. `blessed` / `neo-blessed`
3. `ink`

## 3.2 选型结论

建议采用：`@mariozechner/pi-tui`

理由：

1. 与研究文档中的产品化路径一致，组件化与控制器模式更匹配
2. 更适合状态驱动的聊天日志 + 覆盖层（审批、模型选择）
3. 对终端应用场景（滚动日志、输入组件、工作指示器）适配度更高

风险与缓解：

1. 终端兼容性风险
缓解：保留 `--plain` 文本模式作为回退

2. 组件学习成本
缓解：先做最小 UI 壳，再逐步替换渲染点

## 4. 目标架构（V1.1）

```text
src/
  i18n/
    zh-cn.ts                  # 中文文案字典
    index.ts                  # t(key, params)
  ui/
    app-shell.ts              # TUI 根布局
    components/
      chat-log.ts             # 消息与工具事件
      composer.ts             # 输入编辑器
      status-bar.ts           # 工作状态与模型信息
      approval-modal.ts       # 审批弹层
      help-panel.ts           # 命令帮助
    renderer.ts               # 事件 -> UI 状态映射
  app/
    run-app.ts                # 启动时选择 tui/plain
```

## 5. 分阶段计划

## M1：中文化基建

1. 引入 i18n 字典层
2. 收敛所有用户可见字符串到 key
3. 默认语言固定为 `zh-CN`

验收：`rg` 检查 `src/` 中用户文案不再直接硬编码英文。

## M2：渲染层解耦

1. 定义 `UiAdapter` 接口
2. 将 `renderer` 从直接 `console.log` 改为调用适配器
3. 提供 `PlainAdapter` 兼容现有输出

验收：不改 Agent 逻辑即可切换输出模式。

## M3：接入 `pi-tui` 最小壳

1. 新建 TUI 根布局（日志区 + 输入区 + 状态栏）
2. 将 `AgentEvent` 渲染到聊天日志组件
3. 接入命令输入和提交回调

验收：可在 TUI 中完成一次完整问答。

## M4：审批与交互优化

1. 审批改为弹层按钮（允许一次/允许会话/拒绝）
2. 状态条展示 `thinking/tool/approval/idle`
3. 优化工具结果摘要与错误截断

验收：无需输入 `/approve` 也能完成审批流程。

## M5：回退模式与稳定性

1. 增加 `--plain` 启动参数
2. 为不支持 TUI 的终端自动降级
3. 增加 TUI smoke test 与文案检查测试

验收：TUI 和 plain 两种模式都可运行。

## 6. 详细 TODO 清单

### Phase 0：准备（已完成）

- [x] 新增依赖：`@mariozechner/pi-tui`
- [x] 定义 `UI_MODE=tui|plain` 环境变量
- [x] 约定默认模式：`tui`

### Phase 1：中文文案统一（已完成）

- [x] 新建 `src/i18n/zh-cn.ts` 文案字典
- [x] 新建 `src/i18n/index.ts` 的 `t()` 方法
- [x] 将 `commands.ts` 的英文文案迁移到字典
- [x] 将 `renderer.ts` 的英文日志迁移到字典
- [x] 将 `run-agent.ts` 的状态/错误文案迁移到字典
- [x] 将 README 用户提示改为中文

### Phase 2：UI 适配器抽象（已完成）

- [x] 定义 `UiAdapter` 接口（info/event/error/prompt）
- [x] 实现 `PlainAdapter`（当前行为兼容）
- [x] `AgentRunnerController` 注入 `UiAdapter`
- [x] 所有直接 `console.log` 改为 `UiAdapter`

### Phase 3：TUI 壳接入（已完成）

- [x] 新建 `ui/app-shell.ts` 初始化 pi-tui
- [x] 新建 `chat-log` 组件显示 Query/Answer/ToolEvent
- [x] 新建 `composer` 组件处理输入与提交
- [x] 新建 `status-bar` 显示模型、状态、时间
- [x] 接通 `runApp()` 与 TUI 事件循环

### Phase 4：审批体验升级（已完成）

- [x] 新建 `approval-modal` 组件
- [x] `approval_request` 时弹出审批层
- [x] 选择结果回调到 `AgentRunnerController.approve()`
- [x] 处理 Esc 快捷拒绝

### Phase 5：回退与测试（已完成）

- [x] 增加 `--plain` 命令行参数
- [x] 终端能力探测失败时自动 plain
- [x] 新增 i18n 文案完整性测试
- [x] 新增 TUI smoke test（渲染关键组件）
- [x] 持续执行 `bun run typecheck` 与 `bun test`

## 7. 关键代码片段

## 7.1 中文文案字典

```ts
// src/i18n/zh-cn.ts
export const zhCN = {
  cmdHelpTitle: "可用命令",
  cmdUnknown: "未知命令：{command}",
  stateThinking: "思考中",
  stateTool: "调用工具中",
  stateApproval: "等待审批",
  stateIdle: "空闲",
  approvalRequired: "工具 {tool} 需要你的授权",
  approvalDenied: "你已拒绝本次工具调用",
  finalAnswer: "最终回答"
} as const;
```

## 7.2 文案函数

```ts
// src/i18n/index.ts
import { zhCN } from "./zh-cn";

type DictKey = keyof typeof zhCN;

export function t(key: DictKey, params: Record<string, string> = {}): string {
  const template = zhCN[key];
  return Object.entries(params).reduce((acc, [k, v]) => {
    return acc.replace(`{${k}}`, v);
  }, template);
}
```

## 7.3 UI 适配器

```ts
// src/ui/adapter.ts
import type { AgentEvent } from "../agent/types";

export interface UiAdapter {
  info(message: string): void;
  error(message: string): void;
  renderEvent(event: AgentEvent): void;
  close(): void;
}
```

## 7.4 Plain 适配器（中文输出）

```ts
// src/ui/plain-adapter.ts
import type { AgentEvent } from "../agent/types";
import type { UiAdapter } from "./adapter";
import { t } from "../i18n";

export class PlainAdapter implements UiAdapter {
  public info(message: string): void {
    console.log(message);
  }

  public error(message: string): void {
    console.log(`错误：${message}`);
  }

  public renderEvent(event: AgentEvent): void {
    if (event.type === "thinking") {
      console.log(`[${t("stateThinking")}] ${event.message}`);
      return;
    }

    if (event.type === "done") {
      console.log(`\n${t("finalAnswer")}：\n${event.answer}`);
      return;
    }

    console.log(JSON.stringify(event));
  }

  public close(): void {}
}
```

## 7.5 TUI 启动壳（示意）

```ts
// src/ui/app-shell.ts
import type { UiAdapter } from "./adapter";

export function createTuiAdapter(): UiAdapter {
  // 这里初始化 pi-tui 的 root、chatLog、composer、statusBar、approvalModal
  // 并将 renderEvent 映射到组件状态更新
  return {
    info(message: string) {
      // push info message into chat log
    },
    error(message: string) {
      // push error message into chat log
    },
    renderEvent(event) {
      // update ui state by event
    },
    close() {
      // shutdown tui
    }
  };
}
```

## 8. 验收标准（V1.1 DoD）

1. 所有用户可见日志与交互文案为中文
2. 默认启动为 TUI 界面（日志区、输入区、状态栏）
3. 审批交互支持可点击/可选操作，不依赖文本命令
4. `--plain` 模式可正常运行并与 TUI 功能对齐
5. `bun run typecheck` 与 `bun test` 通过

## 9. 风险与规避

1. TUI 库兼容问题
规避：保留 plain 模式与自动降级。

2. 文案散落导致漏改
规避：通过 `i18n` 字典收拢文案并新增测试校验。

3. 重构过程破坏现有控制器
规避：先引入 `UiAdapter`，后替换具体输出实现。

## 10. 交付顺序建议

1. 先完成 M1 + M2（先把输出中文并解耦渲染）
2. 再完成 M3 + M4（TUI 体验和审批交互）
3. 最后完成 M5（回退与稳定性）

## 11. 对话回归修复（已完成）

基于真实会话回归，新增 3 项修复：

1. 会话上下文缺失：每轮不感知历史
2. 用户输入不展示：发送后在界面消失
3. TUI 交互层次较弱：信息分区与状态反馈不够清晰

### Phase 6：上下文与展示修复（已完成）

- [x] 在 `runAgent` 增加 `history` 参数，支持多轮上下文注入
- [x] 在 `AgentRunnerController` 维护会话内最近多轮对话并传入模型
- [x] 在 `runApp` 中每次输入后立即渲染 `你：...`，避免消息消失

### Phase 7：交互体验优化（已完成）

- [x] 优化 TUI 布局（标题、分隔线、状态栏、帮助区、聊天区、输入区）
- [x] 状态栏增强：显示模型、中文状态、当前时间
- [x] 事件渲染增强：统一中文标签与更清晰的“助手回答”段落
- [x] 在启动时提示“上下文已启用，保留最近 12 轮对话”

### 回归验收（已通过）

- [x] `bun run typecheck` 通过
- [x] `bun test` 通过
- [x] 连续多轮问答能感知历史上下文
- [x] 每轮用户输入会在界面中可见
- [x] TUI 信息层次与可读性明显改善

## 12. 第二轮回归修复（已完成）

新增针对你最新反馈的两项修复：

1. 第二次输入偶发不显示
2. 回答非流式，需等待完整输出

### Phase 8：输入回显稳定性（已完成）

- [x] 在主循环中统一回显用户输入，所有轮次都显示
- [x] 输入展示从具体 UI 实现解耦，plain/tui 行为一致
- [x] 对话区保持“用户输入 -> Agent 过程 -> 助手回答”的顺序稳定

### Phase 9：流式回答渲染（已完成）

- [x] 在 `AgentEvent` 增加 `answer_start/answer_delta/answer_end`
- [x] `runAgent` 增加分块输出逻辑（chunk + delay），逐段发出回答
- [x] TUI 聊天区增加流式缓冲行，边生成边刷新
- [x] plain 模式支持增量写入（`stdout.write`）
- [x] 结束后仍保留 `done` 事件用于历史持久化

### 二次验收（已通过）

- [x] `bun run typecheck` 通过
- [x] `bun test` 通过
- [x] 多轮输入持续可见
- [x] 回答以流式增量形式显示

## 13. 第三轮回归修复（已完成）

新增两项体验修复：

1. 审批交互位置优化：从居中弹窗改为底部交互区
2. 迭代上限优化：到达上限后不直接失败，自动触发最终收敛调用

### Phase 10：审批交互优化（已完成）

- [x] 审批选择层改为底部显示（`bottom-center`），减少遮挡主对话区
- [x] 宽度扩展为 `90%`，选项可读性更高

### Phase 11：最大迭代收敛优化（已完成）

- [x] 增加统一流式输出函数，避免分支重复
- [x] 达到上限后追加一次“禁止工具调用”的最终收敛请求
- [x] 若收敛成功则流式输出最终答案；失败时才回退提示文案
- [x] 中文提示改为“自动收敛已执行”，降低失败感知

### 三次验收（已通过）

- [x] `bun run typecheck` 通过
- [x] `bun test` 通过
- [x] 审批交互位于底部，使用更顺手
- [x] 达到迭代上限时仍会尝试给出最终可用答案
