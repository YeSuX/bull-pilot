# Dexter V0 深度研究报告：单轮工具调用 Agent 最小闭环

## 0. 研究范围与结论

本报告只聚焦一个目标：**跑通“单轮工具调用 Agent”最小闭环**。

这里的“单轮工具调用”定义为：

1. 用户发起一个 query
2. 第一次 LLM 返回至少一个 tool call
3. Agent 执行工具并拿到结果
4. 第二次 LLM 基于工具结果生成最终答案
5. 过程通过事件流反馈到 CLI

结论：`dexter` 当前代码已经具备该闭环的完整实现，而且实现不是 demo 级，而是带有审批、重试、上下文治理、轨迹持久化的工程化版本。

---

## 1. 最小闭环的系统边界

从代码上，最小闭环涉及 6 个核心层：

1. 入口层：`src/index.tsx`
2. 交互控制层：`src/cli.ts` + `src/controllers/agent-runner.ts`
3. Agent 主循环：`src/agent/agent.ts`
4. 模型调用层：`src/model/llm.ts`
5. 工具注册与执行层：`src/tools/registry.ts` + `src/agent/tool-executor.ts`
6. 轨迹与上下文层：`src/agent/scratchpad.ts` + `src/agent/prompts.ts`

其中任何一层缺失，闭环都跑不通。

---

## 2. 入口到执行：真实调用链

## 2.1 进程入口

`src/index.tsx` 做两件事：

1. `dotenv.config({ quiet: true })`
2. `await runCli()`

即环境变量加载后，所有逻辑都进入 CLI runtime。

## 2.2 CLI 到 AgentRunner

在 `runCli()` 中：

1. 构建 `ModelSelectionController`
2. 构建 `AgentRunnerController`
3. 文本提交后调用 `agentRunner.runQuery(query)`

关键点：

1. CLI 不直接操作 Agent
2. CLI 只消费 `AgentRunnerController` 的状态和事件
3. 这使 UI 与 agent 内核解耦

## 2.3 AgentRunner 到 Agent

`runQuery()` 的关键动作顺序：

1. 创建 `AbortController`
2. 把 query 写入内存历史
3. `Agent.create(...)`
4. `for await (const event of agent.run(...))` 流式消费事件
5. 捕获 `done` 事件拿最终答案

这一步把“异步迭代事件流”接到 UI 状态机上。

---

## 3. Agent.create：闭环前置准备

`Agent.create()` 在执行闭环前先做装配：

1. 解析模型（默认 `gpt-5.4`）
2. `getTools(model)` 取可用工具列表
3. 加载 `SOUL.md`（用户覆盖优先）
4. 初始化 memory（若开启）
5. 用上述信息生成 `systemPrompt`

对最小闭环的意义：

1. 没有工具列表，工具调用无法发生
2. 没有系统提示词，LLM 不知道有哪些工具、何时该调用

---

## 4. Agent.run 主循环：最小闭环核心算法

`Agent.run(query, history)` 的逻辑可以抽象成下面的状态机。

## 4.1 初始化

1. 创建 `RunContext`
2. 创建 `Scratchpad(query)`
3. 把初始 prompt 设为 query（或带历史上下文）

## 4.2 每次迭代流程

在 `while (iteration < maxIterations)` 内：

1. 调用 `callModel(currentPrompt)`
2. 解析响应文本与 `tool_calls`
3. 如果无工具调用：
   - 直接 `done(answer)`，闭环结束
4. 如果有工具调用：
   - 逐个执行工具，流式产出 tool 事件
   - 把结果写入 scratchpad
   - 构造下一轮 `buildIterationPrompt(...)`
   - 进入下一次迭代

最小闭环的常见路径是“两次模型调用”：

1. 第一次：规划 + tool_call
2. 第二次：读工具结果 + 给最终答案

## 4.3 错误与边界

主循环还内置了闭环稳定性控制：

1. 上下文溢出时最多重试 2 次，并清理旧工具结果
2. 达到迭代上限返回失败说明
3. 模型异常统一格式化后返回 `done(error message)`

---

## 5. 工具绑定与调用机制

## 5.1 工具绑定发生在模型层

`callLlm()` 在有工具列表时调用 `llm.bindTools(tools)`，因此 LLM 可直接返回结构化 `tool_calls`。

若没绑定工具，返回纯文本。

## 5.2 工具注册策略

`getToolRegistry(model)` 返回工具实例列表。主要特性：

1. 金融、文件系统、浏览器、memory、heartbeat、cron 为默认常驻
2. `web_search` 按 API key 动态启用（Exa -> Perplexity -> Tavily）
3. `skill` 只有发现技能文件时才启用

最小闭环可用性结论：

1. 即便没有搜索 API key，依然有可调用工具（如 `read_file`）
2. 只要模型可用，就能跑通工具调用闭环

## 5.3 工具执行器的关键细节

`AgentToolExecutor.executeAll()` 逐个处理模型返回的工具调用：

1. 先做审批判断（`write_file`/`edit_file`）
2. 再做软限制检查（重复调用预警）
3. 发 `tool_start`
4. 执行 tool.invoke()
5. 流式转发 `tool_progress`
6. 完成后发 `tool_end` 或 `tool_error`
7. 记录结果到 scratchpad

这保证了闭环中的“执行”阶段可观察、可追踪、可恢复。

---

## 6. Scratchpad：闭环的上下文桥

最小闭环能闭上，核心在 scratchpad。

## 6.1 持久化格式

每个 query 在 `.dexter/scratchpad/` 下创建一个 JSONL：

1. `init`
2. `thinking`
3. `tool_result`

## 6.2 关键作用

它承担两种角色：

1. **运行时桥接**：把本轮工具结果注入下一轮 prompt
2. **事后审计**：保留完整执行轨迹

## 6.3 工具结果注入方式

`getToolResults()` 会输出类似：

```text
### read_file(path=package.json)
{"data":{"path":"package.json","content":"..."}}
```

下一轮 prompt 会拼成：

1. 原始 query
2. `Data retrieved from tool calls:`
3. 全量工具结果

模型因此能“看到”自己刚刚调用工具得到的结构化数据。

---

## 7. Prompt 结构如何驱动最小闭环

## 7.1 系统提示词

`buildSystemPrompt()` 注入：

1. 工具描述（名称 + 何时用）
2. 工具使用策略（金融场景优先级）
3. 通道格式规则（CLI/WhatsApp）
4. SOUL / memory / heartbeat 规则

对最小闭环最关键的是“工具描述 + 工具使用策略”，它直接决定模型会不会发 `tool_calls`。

## 7.2 迭代提示词

`buildIterationPrompt()` 负责把工具结果交回模型，并告诉它：

1. 继续完成 query
2. 数据够了就直接答复，不要再调工具

这一步是闭环收敛的关键控制点。

---

## 8. 事件流：从 Agent 到 UI 的可观测闭环

最小闭环在 UI 上的典型事件顺序：

1. `thinking`（可选）
2. `tool_start`
3. `tool_progress`（可选）
4. `tool_end`
5. `done`

`AgentRunnerController` 会把这组事件聚合到一个历史项中，CLI 用它渲染工具卡片、状态、最终答案和性能统计。

---

## 9. 最小可运行路径（建议）

为了稳定复现实验，建议用 `read_file` 工具演示，因为它不依赖外部金融 API。

前提：

1. 有可用模型（如 OpenAI key，或本地 Ollama）
2. `bun install` 完成依赖

步骤：

1. 运行 `bun start`
2. 输入类似：`读取 package.json 的 name 和 version`

预期：

1. 第一次模型调用产生 `read_file` 工具调用
2. 工具读取文件并返回 JSON 字符串
3. 第二次模型调用输出最终答案

这是“单轮工具调用最小闭环”的标准表现。

---

## 10. 闭环中的关键数据结构

## 10.1 AgentEvent

闭环依赖以下事件类型：

1. `thinking`
2. `tool_start` / `tool_end` / `tool_error`
3. `tool_progress`
4. `done`

## 10.2 ToolResult

工具返回统一包装：

```json
{
  "data": ...,
  "sourceUrls": [...]
}
```

这一致性降低了模型消费工具结果的复杂度。

## 10.3 RunContext

每次 run 的最小状态：

1. `query`
2. `scratchpad`
3. `tokenCounter`
4. `iteration`

---

## 11. V0 视角的工程优点

就“最小闭环”而言，当前实现有 6 个明显优点：

1. 分层清晰：CLI、controller、agent、model、tools、scratchpad 各司其职
2. 流式可观测：事件完整，调试和 UX 都更好
3. 工具协议统一：减少了 tool-to-LLM 兼容问题
4. 失败可恢复：重试、上下文清理、错误收敛都做了
5. 安全边界明确：文件工具有 sandbox + 审批
6. 可扩展：工具注册表 + prompt 自动注入描述

---

## 12. V0 阶段的复杂度与风险点

从“只想跑通最小闭环”的角度，当前实现也有几点会增加理解成本：

1. 默认工具集很大（金融、memory、cron、browser 都在），对新手不够“最小”
2. `Agent.create()` 默认会触发 memory 初始化，增加冷启动路径复杂度
3. prompt 非常长，调试“为何调了某工具”时需要更细日志
4. `tool_calls` 执行是串行，某些场景下延迟较高

这些不影响闭环正确性，但会影响 V0 clone 的上手速度。

---

## 13. 给“从零复刻 V0”者的最小实现建议

如果目标是先 clone 出最小闭环，建议先砍到这套最小集合：

1. 保留 `Agent.run` 主循环
2. 保留 `callLlm + bindTools`
3. 只保留 1 个工具：`read_file`
4. 保留 `Scratchpad` 的 `init/tool_result/getToolResults`
5. 保留 `thinking/tool_start/tool_end/done` 四类事件
6. 暂时移除 memory、skills、gateway、cron

先用这 6 点跑通，再逐层加复杂能力，会比直接全量搬运稳得多。

---

## 14. 最终总结

Dexter 当前代码中的“单轮工具调用 Agent 最小闭环”并不是拼凑式实现，而是一个结构化、可扩展、可观测的标准 agent runtime：

1. CLI 触发查询
2. Agent 首轮决策工具调用
3. 工具执行并写入 scratchpad
4. 二轮模型基于工具结果收敛答案
5. 事件流贯穿全程

这条链路已经完整、稳定、且具备生产化雏形。对 clone 项目来说，它可以直接作为 V0 架构模板。
