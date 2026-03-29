# bull-pilot

## 安装依赖

```bash
bun install
```

## 环境变量

创建 `.env`：

```bash
OPENAI_API_KEY=your_kimi_key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
UI_MODE=tui
```

## 运行

```bash
bun run start
```

如果要强制 plain 模式：

```bash
bun run start --plain
```

示例提问：

```text
读取 package.json 的 name 和 version
```

内建命令：

```text
/help
/model [modelId]
/history [count]
/logs
/cancel
/exit
```

## 类型检查

```bash
bun run typecheck
```

## 测试

```bash
bun test
```

## 当前限制（V1.1）

- 默认优先使用 TUI，终端不支持时会自动回退到 plain
- 当前仅实现 `read_file` 与 `write_file` 两个本地工具
