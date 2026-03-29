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

## Typecheck

```bash
bun run typecheck
```

## Known Limits (V0)

- Single tool only: `read_file`
- Single query focus, no persistent memory
- No write-tool approval flow
