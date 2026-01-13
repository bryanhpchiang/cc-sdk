# cc-sdk

A TypeScript library that wraps the Claude CLI, exposing a clean SDK interface similar to the official Claude Agent SDK v2.

## Why?

The official Claude Agent SDK requires the Anthropic API, meaning you pay per-token at API rates. This library wraps the `claude` CLI instead, so you can **use your existing Claude Pro/Max subscription** for programmatic access—no separate API key or additional costs.

- Use your Claude subscription for SDK-style development
- No API key required, no per-token billing
- Access to all CLI features: tools, MCP servers, web search, etc.
- Works with whatever model your subscription supports

## Supported

- One-shot prompts and multi-turn sessions
- Streaming responses with thinking blocks
- Session persistence (save and resume)
- System prompts and model selection
- Built-in CLI tools (file operations, web search, etc.)
- Custom MCP servers
- Custom subagents

## Installation

```bash
# From GitHub
npm install bryanhpchiang/cc-sdk
# or
bun add bryanhpchiang/cc-sdk
```

Requires the Claude CLI to be installed. See [Claude Code setup](https://docs.anthropic.com/en/docs/claude-code).

## Quick Start

### One-shot prompt

```typescript
import { prompt } from "cc-sdk";

const result = await prompt("What is 2 + 2?");
console.log(result.result); // "4"
console.log(result.totalCostUsd); // cost in USD
```

### Session-based (multi-turn)

```typescript
import { createSession } from "cc-sdk";

const session = createSession();

// First turn
await session.send("Remember the number 42.");
for await (const event of session.stream()) {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "text") console.log(block.text);
    }
  }
}

// Second turn (same session, remembers context)
await session.send("What number did I ask you to remember?");
for await (const event of session.stream()) {
  // ...
}

session.close();
```

### Access thinking blocks

The SDK gives you access to Claude's internal reasoning (extended thinking):

```typescript
for await (const event of session.stream()) {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "thinking") {
        console.log("THINKING:", block.thinking);
      } else if (block.type === "text") {
        console.log("RESPONSE:", block.text);
      } else if (block.type === "tool_use") {
        console.log("TOOL:", block.name, block.input);
      }
    }
  }
}
```

### Get session ID

After streaming, you can get the session ID to resume later:

```typescript
const session = createSession();
await session.send("Hello");
for await (const event of session.stream()) {
  // ...
}

const sessionId = session.getSessionId();
console.log("Session ID:", sessionId);
// Save this to resume later
```

### Resume a session

```typescript
import { resumeSession } from "cc-sdk";

const session = resumeSession("existing-session-id");
await session.send("Continue where we left off...");
for await (const event of session.stream()) {
  // ...
}
```

### Filtered streaming

By default, `stream()` yields all CLI events. Use `{ filter: true }` to get only assistant text, tool calls, and results (excludes thinking blocks and system events):

```typescript
for await (const event of session.stream({ filter: true })) {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "text") {
        console.log("TEXT:", block.text);
      } else if (block.type === "tool_use") {
        console.log("TOOL:", block.name, block.input);
      }
    }
  } else if (event.type === "result") {
    console.log("DONE:", event.subtype);
  }
}
```

## Options

```typescript
const session = createSession({
  model: "claude-opus-4-5-20251101",  // default
  systemPrompt: "You are a helpful assistant.",
  appendSystemPrompt: "Always be concise.",
  cwd: "/path/to/working/dir",
  verbose: true,  // enable debug logging
});
```

Or for one-shot:

```typescript
const result = await prompt("Hello", {
  model: "claude-sonnet-4-5-20250929",
  verbose: true,
});
```

## MCP Servers

Connect custom MCP servers to your session:

```typescript
const session = createSession({
  mcpServers: {
    "my-server": {
      command: "npx",
      args: ["-y", "tsx", "./path/to/server.ts"],
      env: { API_KEY: "..." }
    }
  }
});
```

By default, sessions do not inherit MCP servers from your user config—only explicitly configured servers are available.

## Custom Subagents

Define custom subagents that can be invoked during the session:

```typescript
const session = createSession({
  agents: {
    "reviewer": {
      description: "Reviews code for best practices",
      prompt: "You are a code reviewer. Analyze code for bugs and improvements."
    }
  }
});
```

## Event Types

The SDK yields these event types from `stream()`:

| Type | Description |
|------|-------------|
| `system` | Session initialization (contains `session_id`, `tools`, etc.) |
| `assistant` | Model responses (text, thinking, tool_use blocks) |
| `user` | Tool results |
| `result` | Final result with cost, duration, success/error status |

## Default Model

The default model is `claude-opus-4-5-20251101`. You can import and check it:

```typescript
import { DEFAULT_MODEL } from "cc-sdk";
console.log(DEFAULT_MODEL); // "claude-opus-4-5-20251101"
```

## Installation (Local Development)

To use this in another project on your machine:

**Using npm (Electron, etc.):**

```bash
# In the cc-sdk directory
npm link

# In your other project
npm link cc-sdk
```

**Using bun:**

```bash
# In the cc-sdk directory
bun link

# In your other project
bun link cc-sdk
```

**Or reference it directly by path:**

```bash
# npm
npm install ../path/to/cc-sdk

# bun
bun add ../path/to/cc-sdk
```

**Note:** Works with both Bun and Node.js (including Electron).

---

## API Reference

### Types Overview

All types are exported from the package:

```typescript
import type {
  // Events
  SDKEvent,
  SystemInitEvent,
  AssistantEvent,
  UserEvent,
  ResultEvent,
  ResultSuccessEvent,
  ResultErrorEvent,

  // Content blocks
  ContentBlock,
  ThinkingBlock,
  TextBlock,
  ToolUseBlock,

  // Messages
  AssistantMessage,
  ToolResultContent,

  // Config
  SessionOptions,
  StreamOptions,
  MCPServerConfig,
  AgentConfig,
  PromptResult,
} from "cc-sdk";
```

---

### SDKEvent

Union type of all possible events from `stream()`:

```typescript
type SDKEvent = SystemInitEvent | AssistantEvent | UserEvent | ResultEvent;
```

---

### SystemInitEvent

Emitted once at the start of a session with initialization info.

```typescript
interface SystemInitEvent {
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
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"system"` | Event type identifier |
| `subtype` | `"init"` | Always "init" for initialization |
| `uuid` | `string` | Unique event ID |
| `session_id` | `string` | Session ID for resumption |
| `cwd` | `string` | Working directory |
| `tools` | `string[]` | Available tool names |
| `mcp_servers` | `Array<{name, status}>` | Connected MCP servers |
| `model` | `string` | Model being used |
| `permissionMode` | `string` | Permission mode (e.g., "dangerously-skip-permissions") |

---

### AssistantEvent

Emitted when the model produces a response.

```typescript
interface AssistantEvent {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: AssistantMessage;
  parent_tool_use_id: string | null;
}

interface AssistantMessage {
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
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"assistant"` | Event type identifier |
| `uuid` | `string` | Unique event ID |
| `session_id` | `string` | Session ID |
| `message` | `AssistantMessage` | The model's response |
| `parent_tool_use_id` | `string \| null` | Parent tool ID if this is a subagent response |

#### AssistantMessage fields

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string` | Model that generated the response |
| `id` | `string` | Message ID |
| `content` | `ContentBlock[]` | Array of content blocks |
| `stop_reason` | `string \| null` | Why generation stopped (e.g., "end_turn", "tool_use") |
| `usage` | `object` | Token usage statistics |

---

### ContentBlock

Union type for content within an AssistantMessage:

```typescript
type ContentBlock = ThinkingBlock | TextBlock | ToolUseBlock;
```

#### ThinkingBlock

Claude's internal reasoning (extended thinking).

```typescript
interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"thinking"` | Block type identifier |
| `thinking` | `string` | The model's reasoning text |
| `signature` | `string` | Cryptographic signature |

#### TextBlock

Regular text output from the model.

```typescript
interface TextBlock {
  type: "text";
  text: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"text"` | Block type identifier |
| `text` | `string` | The text content |

#### ToolUseBlock

A tool invocation by the model.

```typescript
interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"tool_use"` | Block type identifier |
| `id` | `string` | Unique tool use ID |
| `name` | `string` | Tool name (e.g., "Bash", "Read", "Write") |
| `input` | `Record<string, unknown>` | Tool input parameters |

---

### UserEvent

Emitted when a tool returns its result.

```typescript
interface UserEvent {
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

interface ToolResultContent {
  tool_use_id: string;
  type: "tool_result";
  content: string;
  is_error: boolean;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"user"` | Event type identifier |
| `uuid` | `string` | Unique event ID |
| `session_id` | `string` | Session ID |
| `message.content` | `ToolResultContent[]` | Tool results |
| `parent_tool_use_id` | `string \| null` | Parent tool ID for nested calls |

#### ToolResultContent fields

| Field | Type | Description |
|-------|------|-------------|
| `tool_use_id` | `string` | ID of the tool use this responds to |
| `type` | `"tool_result"` | Always "tool_result" |
| `content` | `string` | The tool's output |
| `is_error` | `boolean` | Whether the tool errored |

---

### ResultEvent

Emitted at the end of a turn. Can be success or error.

```typescript
type ResultEvent = ResultSuccessEvent | ResultErrorEvent;
```

#### ResultSuccessEvent

```typescript
interface ResultSuccessEvent {
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
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"result"` | Event type identifier |
| `subtype` | `"success"` | Indicates successful completion |
| `is_error` | `false` | Always false for success |
| `duration_ms` | `number` | Total duration in milliseconds |
| `duration_api_ms` | `number` | Time spent in API calls |
| `num_turns` | `number` | Number of turns taken |
| `result` | `string` | Final text result |
| `total_cost_usd` | `number` | Total cost in USD |
| `usage` | `object` | Aggregate token usage |
| `permission_denials` | `Array` | Tools that were denied permission |

#### ResultErrorEvent

```typescript
interface ResultErrorEvent {
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
```

| Field | Type | Description |
|-------|------|-------------|
| `subtype` | `string` | Error type (see below) |
| `is_error` | `true` | Always true for errors |
| `errors` | `string[]` | Error messages |

**Error subtypes:**
- `error_max_turns` - Exceeded maximum turn limit
- `error_during_execution` - Runtime error occurred
- `error_max_budget_usd` - Exceeded cost budget
- `error_max_structured_output_retries` - Structured output parsing failed

---

### SessionOptions

Configuration for `createSession()`:

```typescript
interface SessionOptions {
  model?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  cwd?: string;
  verbose?: boolean;
  mcpServers?: Record<string, MCPServerConfig>;
  agents?: Record<string, AgentConfig>;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | `claude-opus-4-5-20251101` | Model to use |
| `systemPrompt` | `string` | - | Override system prompt |
| `appendSystemPrompt` | `string` | - | Append to system prompt |
| `cwd` | `string` | - | Working directory |
| `verbose` | `boolean` | `false` | Enable debug logging |
| `mcpServers` | `Record<string, MCPServerConfig>` | - | MCP servers to connect |
| `agents` | `Record<string, AgentConfig>` | - | Custom subagents |

---

### MCPServerConfig

Configuration for an MCP server:

```typescript
interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | Command to run (e.g., "npx") |
| `args` | `string[]` | Command arguments |
| `env` | `Record<string, string>` | Environment variables |

---

### AgentConfig

Configuration for a custom subagent:

```typescript
interface AgentConfig {
  description: string;
  prompt: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Short description of what the agent does |
| `prompt` | `string` | System prompt for the agent |

---

### StreamOptions

Options for `stream()`:

```typescript
interface StreamOptions {
  filter?: boolean;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | `boolean` | `false` | If true, excludes thinking blocks and system events |

---

### PromptResult

Return type from `prompt()`:

```typescript
interface PromptResult {
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
```

| Field | Type | Description |
|-------|------|-------------|
| `result` | `string` | The model's text response |
| `sessionId` | `string` | Session ID (can be used to resume) |
| `totalCostUsd` | `number` | Cost in USD |
| `usage.inputTokens` | `number` | Input tokens used |
| `usage.outputTokens` | `number` | Output tokens used |
| `isError` | `boolean` | Whether an error occurred |
| `errors` | `string[]` | Error messages (if `isError` is true) |

## License

MIT
