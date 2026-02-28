export interface LLMCallRecord {
  seq: number;
  ts: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  status_code: number;
  request_hash: string;
  response_hash: string;
  token_extraction: "exact" | "fallback" | "unknown";
}

export interface ConstraintViolation {
  type: "token_budget" | "call_limit" | "model_violation" | "network_blocked";
  detail: string;
  seq: number;
  ts: string;
}

export interface VerifiedAttestation {
  image_digest: string;
  nonce: string;
  chain_head_hash: string;
  chain_length: number;
  llm_calls: LLMCallRecord[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_llm_calls: number;
  total_tool_calls: number;
  wall_clock_secs: number;
  constraint_violations: ConstraintViolation[];
}
