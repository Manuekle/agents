import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.mjs", "--agent", "example.agent.json"],
});
const client = new Client({ name: "test", version: "1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map(t => t.name).join(", "));
const prompts = await client.listPrompts();
console.log("PROMPTS:", prompts.prompts.map(p => p.name).join(", "));
const res = await client.listResources();
console.log("RESOURCES:", res.resources.map(r => r.uri).join(", "));

const info = await client.callTool({ name: "agent_info", arguments: {} });
console.log("agent_info ->", info.content[0].text.replace(/\n/g,' '));

const spec = await client.readResource({ uri: "agent://skills" });
console.log("agent://skills ->", spec.contents[0].text.replace(/\s+/g,' '));

const prompt = await client.getPrompt({ name: "activate_agent", arguments: {} });
console.log("activate_agent first 90 chars ->", prompt.messages[0].content.text.slice(0,90).replace(/\n/g,' '));

await client.close();
console.log("OK");
