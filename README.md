# cc-sdk

A TypeScript library that wraps the Claude CLI, exposing a clean SDK interface similar to the official Claude Agent SDK v2.

## ⚠️ Not Yet Supported

- Custom MCP servers (coming soon)
- Custom subagents (coming soon)

## Why?

The official Claude Agent SDK requires the Anthropic API. This library wraps the `claude` CLI instead, which means:

- Uses your existing Claude Code authentication (no separate API key needed)
- Access to all CLI features: tools, MCP servers, web search, etc.
- Works with whatever model your Claude Code subscription supports

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

## License

MIT
