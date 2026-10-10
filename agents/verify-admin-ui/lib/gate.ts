import { existsSync, readFileSync } from "node:fs";
import { NAME, findRoot, hasUncommittedChanges, loadConfig, paths, treeHash } from "./project.ts";

/**
 * Claude Code Stop hook. Blocks the stop while watched files have uncommitted changes that no
 * passing run covers. Outside a project with .verify/admin-ui.json it does nothing.
 */
export async function gate(): Promise<number> {
  const text = process.stdin.isTTY ? "" : await Bun.stdin.text();
  const input: { cwd?: string; stop_hook_active?: boolean } = JSON.parse(text || "{}");
  const root = findRoot(input.cwd ?? process.cwd());
  if (!root || process.env.VERIFY_ADMIN_UI_GATE === "off") return 0;

  const config = loadConfig(root);
  if (!hasUncommittedChanges(root, config)) return 0;
  const { stamp } = paths(root);
  if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === treeHash(root, config)) return 0;

  // A second block in a row would loop forever when the agent cannot get to green; hand it to the user.
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ systemMessage: `${NAME}: admin UI changes are not verified (last run failed or is stale).` }));
    return 0;
  }
  console.log(
    JSON.stringify({
      decision: "block",
      reason:
        `Admin UI files changed since the last passing run. Run \`~/.claude/bin/${NAME} run\` and fix what it reports ` +
        "before you finish. If you cannot get it green, say exactly what still fails.",
    }),
  );
  return 0;
}
