import { existsSync, readFileSync } from "node:fs";
import { findRoot, hasUncommittedChanges, loadConfig, paths, treeHash } from "./project.mjs";

/**
 * Claude Code Stop hook. Blocks the stop while watched files have uncommitted changes that no
 * passing `verify run` covers. Outside a project with verify.config.json it does nothing.
 */
export async function gate() {
  const input = JSON.parse((await readStdin()) || "{}");
  const root = findRoot(input.cwd ?? process.cwd());
  if (!root || process.env.VERIFY_GATE === "off") return 0;

  const config = loadConfig(root);
  if (!hasUncommittedChanges(root, config)) return 0;
  const { stamp } = paths(root);
  if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === treeHash(root, config)) return 0;

  // A second block in a row would loop forever when the agent cannot get to green; hand it to the user.
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ systemMessage: "verify: UI changes are not verified (last `verify run` failed or is stale)." }));
    return 0;
  }
  console.log(
    JSON.stringify({
      decision: "block",
      reason:
        "UI files changed since the last passing `verify run`. Run `~/.claude/bin/verify run` and fix what it reports " +
        "before you finish. If you cannot get it green, say exactly what still fails.",
    }),
  );
  return 0;
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
