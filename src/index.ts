import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createLlmClient, getModelName } from "./model/client";
import { runAgent } from "./agent/run-agent";

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const query = await rl.question("Query> ");
  rl.close();

  if (query.trim().length === 0) {
    console.log("Empty query");
    return;
  }

  const client = createLlmClient();
  const model = getModelName();

  for await (const event of runAgent(client, model, query.trim())) {
    if (event.type === "thinking") {
      console.log(`[thinking] ${event.message}`);
      continue;
    }

    if (event.type === "tool_start") {
      console.log(`[tool_start] ${event.name} ${JSON.stringify(event.input)}`);
      continue;
    }

    if (event.type === "tool_end") {
      console.log(`[tool_end] ${event.name}`);
      continue;
    }

    if (event.type === "tool_error") {
      console.log(`[tool_error] ${event.name}: ${event.error}`);
      continue;
    }

    console.log(`\nFinal Answer:\n${event.answer}`);
  }
}

main().catch((error: Error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
