// Event types matching Claude CLI stream-json output

export interface SystemInitEvent {
  type: "system";
  subtype: "init";
  uuid: string;
  session_id: string;
  cwd: string;
  tools: string[];
  mcp_servers: Array<{ name: string; status: string }>;
  model: string;
  permissionMode: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = ThinkingBlock | TextBlock | ToolUseBlock;

export interface AssistantMessage {
  model: string;
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface AssistantEvent {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: AssistantMessage;
  parent_tool_use_id: string | null;
}

export interface ToolResultContent {
  tool_use_id: string;
  type: "tool_result";
  content: string;
  is_error: boolean;
}

export interface UserEvent {
  type: "user";
  uuid: string;
  session_id: string;
  message: {
    role: "user";
    content: ToolResultContent[];
  };
  parent_tool_use_id: string | null;
  tool_use_result?: Record<string, unknown>;
}

export interface ResultSuccessEvent {
  type: "result";
  subtype: "success";
  uuid: string;
  session_id: string;
  is_error: false;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
}

export interface ResultErrorEvent {
  type: "result";
  subtype:
    | "error_max_turns"
    | "error_during_execution"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: string;
  session_id: string;
  is_error: true;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  errors: string[];
}

export type ResultEvent = ResultSuccessEvent | ResultErrorEvent;

export type SDKEvent =
  | SystemInitEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent;

export const DEFAULT_MODEL = "claude-opus-4-5-20251101";

// MCP server configuration
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// Custom agent configuration
export interface AgentConfig {
  description: string;
  prompt: string;
}

// Options for creating sessions
export interface SessionOptions {
  model?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  cwd?: string;
  verbose?: boolean;
  mcpServers?: Record<string, MCPServerConfig>;
  agents?: Record<string, AgentConfig>;
  chrome?: boolean;
}

// Stream options
export interface StreamOptions {
  filter?: boolean;
}

// Result from one-shot prompt
export interface PromptResult {
  result: string;
  sessionId: string;
  totalCostUsd: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  isError: boolean;
  errors?: string[];
}
