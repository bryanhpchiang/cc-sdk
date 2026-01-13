import { createSession } from "../src/index.ts";

async function testChromeMcp() {
  console.log("=== Testing Chrome MCP ===\n");

  const session = createSession({
    chrome: true,
    verbose: true,
  });

  await session.send("Navigate to https://example.com, take a screenshot, and describe what you see");

  for await (const event of session.stream({ filter: true })) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          console.log("TEXT:", block.text);
        } else if (block.type === "tool_use") {
          console.log("TOOL:", block.name, JSON.stringify(block.input).slice(0, 200));
        }
      }
    } else if (event.type === "result") {
      console.log("RESULT:", event.subtype);
      if (event.subtype === "success") {
        console.log("Cost: $" + event.total_cost_usd.toFixed(4));
      }
    }
  }

  session.close();
}

testChromeMcp().catch(console.error);
