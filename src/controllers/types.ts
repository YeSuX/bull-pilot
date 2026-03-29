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

export type ApprovalDecision = "allow-once" | "allow-session" | "deny";
