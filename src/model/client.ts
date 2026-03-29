import OpenAI from "openai";

export function createLlmClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!baseURL) {
    throw new Error("Missing OPENAI_BASE_URL");
  }

  return new OpenAI({ apiKey, baseURL });
}

export function getModelName(): string {
  return process.env.OPENAI_MODEL || "kimi-k2-0711-preview";
}
