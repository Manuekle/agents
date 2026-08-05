import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync, rmSync } from "node:fs";

// Smoke test, not a unit suite: it starts the real server over stdio and asks
// it the questions a client would. The assertions are the point — a run that
// only printed output would have kept passing when list_skills started
// answering with the whole agent instead of one specialist's components.

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`ok   ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(specFile) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["index.mjs", "--agent", specFile],
  });
  const client = new Client({ name: "test", version: "1" });
  await client.connect(transport);
  return client;
}

const text = (r) => r.content[0].text;

// ---- v2: the orchestrator/subagent spec the composer writes now ------------
{
  const client = await open("example.agent.json");

  const tools = (await client.listTools()).tools.map((t) => t.name);
  const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
  const resources = (await client.listResources()).resources.map((r) => r.uri);
  console.log("TOOLS:", tools.join(", "));
  console.log("PROMPTS:", prompts.join(", "));
  console.log("RESOURCES:", resources.join(", "));

  check("registers list_subagents", tools.includes("list_subagents"));
  check("registers activate_subagent", prompts.includes("activate_subagent"));
  check("registers agent://subagents", resources.includes("agent://subagents"));

  const info = JSON.parse(text(await client.callTool({ name: "agent_info", arguments: {} })));
  check("reports spec v2", info.specVersion === 2, `got ${info.specVersion}`);
  check("counts 2 subagents", info.subagentCount === 2, `got ${info.subagentCount}`);
  check("counts 3 components", info.skillCount === 3, `got ${info.skillCount}`);
  check("orchestrator owns 1", info.ownSkillCount === 1, `got ${info.ownSkillCount}`);

  // Scoping is the whole reason list_skills grew an argument.
  const all = JSON.parse(text(await client.callTool({ name: "list_skills", arguments: {} })));
  const scoped = JSON.parse(
    text(await client.callTool({ name: "list_skills", arguments: { agent: "Security Pass" } })),
  );
  check("unscoped list_skills returns all", all.length === 3, `got ${all.length}`);
  check("scoped list_skills returns one", scoped.length === 1, `got ${scoped.length}`);
  check("scoped to the right component", scoped[0]?.name === "Security Review", scoped[0]?.name);

  // Case-insensitive, because a client passes whatever a human typed.
  const lower = JSON.parse(
    text(await client.callTool({ name: "list_skills", arguments: { agent: "security pass" } })),
  );
  check("lookup is case-insensitive", lower.length === 1);

  const unknown = await client.callTool({ name: "list_skills", arguments: { agent: "nope" } });
  check("unknown agent is an error", unknown.isError === true);
  check("error names the known agents", /Security Pass/.test(text(unknown)));

  const rootPrompt = text(await client.callTool({ name: "system_prompt", arguments: {} }));
  const subPrompt = text(
    await client.callTool({ name: "system_prompt", arguments: { agent: "A11y Pass" } }),
  );
  check("root system_prompt", /Terse, severity-tagged/.test(rootPrompt));
  check("scoped system_prompt", /WCAG 2\.2/.test(subPrompt), subPrompt.slice(0, 40));

  const persona = (await client.getPrompt({ name: "activate_agent", arguments: {} })).messages[0]
    .content.text;
  check("persona lists the roster", /## Subagents you can delegate to/.test(persona));
  check("roster names a specialist", /\*\*Security Pass\*\*/.test(persona));
  // The root persona must advertise only what the root holds, or the model
  // will reach for a tool that belongs to a specialist.
  check("persona scopes components to the root", !/- Security Review/.test(persona));

  const activated = (
    await client.getPrompt({ name: "activate_subagent", arguments: { name: "A11y Pass" } })
  ).messages[0].content.text;
  check("activate_subagent loads the specialist", /You are "A11y Pass"/.test(activated));
  check("specialist knows its parent", /under "Pixel Reviewer"/.test(activated));

  const missing = (
    await client.getPrompt({ name: "activate_subagent", arguments: { name: "ghost" } })
  ).messages[0].content.text;
  check("unknown specialist is explained", /No subagent named "ghost"/.test(missing));

  await client.close();
}

// ---- v1: a spec written before the canvas existed --------------------------
{
  const v1 = "test.v1.agent.json";
  writeFileSync(
    v1,
    JSON.stringify({
      name: "Legacy",
      role: "an older agent",
      model: "claude-opus-5",
      temperature: 0.5,
      system: "You predate the canvas.",
      skills: [{ name: "Security Review", repo: "anthropics/skills" }],
    }),
  );

  try {
    const client = await open(v1);
    const info = JSON.parse(text(await client.callTool({ name: "agent_info", arguments: {} })));
    check("v1 spec loads", info.name === "Legacy");
    check("v1 reports version 1", info.specVersion === 1, `got ${info.specVersion}`);
    check("v1 has no subagents", info.subagentCount === 0);
    // With nobody to delegate to, everything is the root's — anything else
    // would leave a v1 agent advertising no tools at all.
    check("v1 root owns every component", info.ownSkillCount === 1, `got ${info.ownSkillCount}`);

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    check("v1 hides activate_subagent", !prompts.includes("activate_subagent"));

    const persona = (await client.getPrompt({ name: "activate_agent", arguments: {} })).messages[0]
      .content.text;
    check("v1 persona lists its components", /- Security Review/.test(persona));
    check("v1 persona has no roster", !/## Subagents/.test(persona));

    await client.close();
  } finally {
    rmSync(v1, { force: true });
  }
}

console.log(failures === 0 ? "OK" : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
