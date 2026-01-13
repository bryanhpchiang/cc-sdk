import { DEFAULT_MODEL, type SessionOptions, type SDKEvent } from "./types.ts";
import { existsSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { spawn, type ChildProcess } from "child_process";

export interface SpawnOptions extends SessionOptions {
  resumeSessionId?: string;
  prompt: string;
}

function findClaudeExecutable(): string {
  // Check common locations
  const locations = [
    join(homedir(), ".claude", "local", "claude"),
    join(homedir(), ".claude", "local", "node_modules", ".bin", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];

  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }

  // Fall back to just "claude" and hope it's in PATH
  return "claude";
}

function writeTempMcpConfig(config: object): string {
  const path = join(tmpdir(), `cc-sdk-mcp-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(config));
  return path;
}

export interface CLIProcess {
  process: ChildProcess;
  kill: () => void;
  exited: Promise<number>;
}

export function buildArgs(options: SpawnOptions): string[] {
  const args: string[] = [
    "-p",
    "--output-format",
    "stream-json",
    "--dangerously-skip-permissions",
  ];

  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId);
  }

  args.push("--model", options.model ?? DEFAULT_MODEL);

  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt);
  }

  if (options.appendSystemPrompt) {
    args.push("--append-system-prompt", options.appendSystemPrompt);
  }

  // MCP servers - write config to temp file, use strict mode to not inherit user defaults
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    const mcpConfig = { mcpServers: options.mcpServers };
    const configPath = writeTempMcpConfig(mcpConfig);
    args.push("--mcp-config", configPath, "--strict-mcp-config");
  }

  // Custom agents - pass as JSON string
  if (options.agents && Object.keys(options.agents).length > 0) {
    args.push("--agents", JSON.stringify(options.agents));
  }

  // Chrome integration
  if (options.chrome) {
    args.push("--chrome");
  }

  // Add the prompt as the final argument
  args.push(options.prompt);

  return args;
}

export function spawnCLI(options: SpawnOptions): CLIProcess {
  const args = buildArgs(options);
  const claudePath = findClaudeExecutable();
  if (options.verbose) {
    console.log("[cc-sdk] spawning:", claudePath, args);
  }

  const proc = spawn(claudePath, args, {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],  // ignore stdin - CLI hangs otherwise
  });

  if (options.verbose && proc.stderr) {
    proc.stderr.on("data", (chunk: Buffer) => {
      console.log("[cc-sdk] stderr:", chunk.toString());
    });
  }

  const exited = new Promise<number>((resolve, reject) => {
    proc.on("close", (code) => {
      if (options.verbose) console.log("[cc-sdk] process closed with code:", code);
      resolve(code ?? 0);
    });
    proc.on("error", (err) => {
      if (options.verbose) console.log("[cc-sdk] process error:", err);
      reject(err);
    });
  });

  return {
    process: proc,
    kill: () => proc.kill(),
    exited,
  };
}

export async function* streamEvents(
  cli: CLIProcess,
  verbose?: boolean
): AsyncGenerator<SDKEvent, void, unknown> {
  const stdout = cli.process.stdout;
  if (!stdout) {
    throw new Error("No stdout available");
  }

  if (verbose) console.log("[cc-sdk] starting stream...");

  let buffer = "";

  // Use a promise-based approach for Node.js compatibility
  const lines: string[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  stdout.on("data", (chunk: Buffer) => {
    if (verbose) console.log("[cc-sdk] got chunk:", chunk.length, "bytes");
    buffer += chunk.toString();

    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      if (line.trim()) {
        lines.push(line);
      }
    }

    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stdout.on("end", () => {
    if (verbose) console.log("[cc-sdk] stdout ended");
    done = true;
    if (buffer.trim()) {
      lines.push(buffer);
    }
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stdout.on("error", (err) => {
    if (verbose) console.log("[cc-sdk] stdout error:", err);
    done = true;
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  while (true) {
    while (lines.length > 0) {
      const line = lines.shift()!;
      try {
        const event = JSON.parse(line) as SDKEvent;
        yield event;
      } catch {
        if (verbose) {
          console.warn("[cc-sdk] failed to parse line:", line);
        }
      }
    }

    if (done) break;

    // Wait for more data
    await new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
  }

  if (verbose) console.log("[cc-sdk] stream complete");
}
