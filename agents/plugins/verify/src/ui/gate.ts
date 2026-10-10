import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasUncommittedChanges, loadConfig, paths, rootsFor, treeHash } from "./config.ts";
import type { UiTool } from "./tool.ts";

type HookInput = { session_id?: string; cwd?: string; stop_hook_active?: boolean };

async function readInput(): Promise<HookInput> {
  const text = process.stdin.isTTY ? "" : await Bun.stdin.text();
  return JSON.parse(text || "{}");
}

function* targets(tools: UiTool[], cwd: string) {
  for (const tool of tools) {
    for (const root of rootsFor(tool, cwd)) yield { tool, root, config: loadConfig(tool, root) };
  }
}

function baselineFile(sessionId: string, tool: UiTool, root: string): string {
  const key = new Bun.CryptoHasher("sha1").update(`${tool.name}\0${root}`).digest("hex");
  return join(tmpdir(), "claude-verify", sessionId.replace(/[^\w-]/g, "_"), key);
}

/**
 * Claude Code UserPromptSubmit hook. On a session's first prompt, records each tool's tree hash so
 * the Stop hook can tell the session's changes from ones that were already in the working tree.
 */
export async function baseline(tools: UiTool[]): Promise<number> {
  const input = await readInput();
  if (!input.session_id) return 0;
  for (const { tool, root, config } of targets(tools, input.cwd ?? process.cwd())) {
    const file = baselineFile(input.session_id, tool, root);
    if (existsSync(file)) continue;
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, treeHash(tool, root, config));
  }
  return 0;
}

/**
 * Claude Code Stop hook over every registered UI tool. Blocks the stop while a tool's watched files
 * changed during the session and no passing run matches them. With no baseline for the session it
 * falls back to uncommitted changes. Tools with no config in the project are skipped.
 */
export async function gate(tools: UiTool[]): Promise<number> {
  if (process.env.VERIFY_GATE === "off") return 0;
  const input = await readInput();

  const stale: string[] = [];
  for (const { tool, root, config } of targets(tools, input.cwd ?? process.cwd())) {
    const current = treeHash(tool, root, config);
    const file = input.session_id ? baselineFile(input.session_id, tool, root) : null;
    const changed = file && existsSync(file) ? readFileSync(file, "utf8") !== current : hasUncommittedChanges(tool, root, config);
    if (!changed) continue;
    const { stamp } = paths(tool, root);
    if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === current) continue;
    stale.push(tool.name);
  }
  if (!stale.length) return 0;

  const names = [...new Set(stale)];
  // A second block in a row would loop forever when the agent cannot get to green; hand it to the user.
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ systemMessage: `verify: changes not verified for ${names.join(", ")} (last run failed or is stale).` }));
    return 0;
  }
  console.log(
    JSON.stringify({
      decision: "block",
      reason:
        `Files changed since the last passing run. Run ${names.map((n) => `\`verify ${n} run\``).join(" and ")} ` +
        "from the app root and fix what it reports before you finish. If you cannot get it green, say exactly what still fails.",
    }),
  );
  return 0;
}
