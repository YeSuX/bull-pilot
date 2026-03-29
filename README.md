# bull-pilot

## Install

```bash
bun install
```

## Environment

Create `.env`:

```bash
OPENAI_API_KEY=your_kimi_key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2-0711-preview
```

## Run

```bash
bun run start
```

Example query:

```text
读取 package.json 的 name 和 version
```

Built-in commands:

```text
/help
/model [modelId]
/history [count]
/approve allow-once|allow-session|deny
/cancel
/exit
```

## Typecheck

```bash
bun run typecheck
```

## Test

```bash
bun test
```

## Known Limits (V0)

- REPL 是文本模式，不是全屏 TUI
- 当前仅实现 `read_file` 与 `write_file` 两个本地工具
