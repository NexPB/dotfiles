import { existsSync, readFileSync } from "node:fs";
import { findRoot, hasUncommittedChanges, loadConfig, paths, treeHash } from "./config.ts";
import type { UiTool } from "./tool.ts";

/**
 * Claude Code Stop hook over every registered UI tool. Blocks the stop while a tool's watched files
 * have uncommitted changes that no passing run covers. Tools with no config in the project are skipped.
 */
export async function gate(tools: UiTool[]): Promise<number> {
  if (process.env.VERIFY_GATE === "off") return 0;
  const text = process.stdin.isTTY ? "" : await Bun.stdin.text();
  const input: { cwd?: string; stop_hook_active?: boolean } = JSON.parse(text || "{}");
  const cwd = input.cwd ?? process.cwd();

  const stale = tools.filter((tool) => {
    const root = findRoot(tool, cwd);
    if (!root) return false;
    const config = loadConfig(tool, root);
    if (!hasUncommittedChanges(tool, root, config)) return false;
    const { stamp } = paths(tool, root);
    return !(existsSync(stamp) && readFileSync(stamp, "utf8").trim() === treeHash(tool, root, config));
  });
  if (!stale.length) return 0;

  const names = stale.map((tool) => tool.name);
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
        "and fix what it reports before you finish. If you cannot get it green, say exactly what still fails.",
    }),
  );
  return 0;
}
