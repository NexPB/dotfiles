import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { UiTool } from "./tool.ts";

export type Page = {
  name: string;
  path: string;
  waitFor?: string;
  mask?: string[];
  maxDiffPixels?: number;
};

export type Config = {
  baseUrl: string;
  loginPath: string;
  viewport: { width: number; height: number };
  watch: string[];
  maxDiffPixels: number;
  pages: Page[];
};

const BASE: Config = {
  baseUrl: "http://localhost:3000",
  loginPath: "/",
  viewport: { width: 1280, height: 900 },
  watch: [],
  maxDiffPixels: 0,
  pages: [],
};

/** The tool's config file, relative to the app root. */
export const configFile = (tool: UiTool) => `.verify/${tool.name}.json`;

/** Walks up from `start` to the nearest directory holding the tool's config; null when there is none. */
export function findRoot(tool: UiTool, start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, configFile(tool)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Every app root for the tool that a session in `cwd` can touch: the nearest one at or above `cwd`,
 * plus those below it in the same git repository, for sessions started at a monorepo's top.
 */
export function rootsFor(tool: UiTool, cwd: string): string[] {
  const roots = new Set<string>();
  const above = findRoot(tool, cwd);
  if (above) roots.add(above);
  const proc = Bun.spawnSync(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", `:(glob)**/${configFile(tool)}`],
    { cwd, stderr: "ignore" },
  );
  if (proc.success) {
    for (const file of proc.stdout.toString().split("\0").filter(Boolean)) {
      roots.add(join(cwd, file.slice(0, -configFile(tool).length)).replace(/\/$/, ""));
    }
  }
  return [...roots];
}

/** The config `init` writes: base values overlaid with the tool's defaults. */
export function starterConfig(tool: UiTool): Config {
  return { ...BASE, ...tool.defaults, pages: [{ name: "home", path: "/" }] };
}

export function loadConfig(tool: UiTool, root: string): Config {
  const raw = JSON.parse(readFileSync(join(root, configFile(tool)), "utf8"));
  const defaults = { ...BASE, ...tool.defaults };
  const config: Config = { ...defaults, ...raw, viewport: { ...defaults.viewport, ...raw.viewport } };
  const seen = new Set<string>();
  for (const page of config.pages) {
    if (!page.name || !page.path) throw new Error(`each page needs "name" and "path": ${JSON.stringify(page)}`);
    // The name becomes a file name under out/ and baseline/.
    if (!/^[\w-]+$/.test(page.name)) throw new Error(`page name "${page.name}" may only use letters, digits, _ and -`);
    if (seen.has(page.name)) throw new Error(`duplicate page name "${page.name}"`);
    seen.add(page.name);
  }
  return config;
}

export function paths(tool: UiTool, root: string) {
  const dir = join(root, ".verify", tool.name);
  return {
    dir,
    auth: join(dir, "auth.json"),
    stamp: join(dir, "pass"),
    baseline: join(dir, "baseline"),
    out: join(dir, "out"),
  };
}

function git(root: string, args: string[]): string {
  const proc = Bun.spawnSync(["git", ...args], { cwd: root, stderr: "pipe" });
  if (!proc.success) throw new Error(`git ${args[0]}: ${proc.stderr.toString().trim()}`);
  return proc.stdout.toString();
}

const watchSpecs = (tool: UiTool, config: Config) => ["--", configFile(tool), ...config.watch];

/** sha256 over the path and content of every watched file, committed or not. */
export function treeHash(tool: UiTool, root: string, config: Config): string {
  const out = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", ...watchSpecs(tool, config)]);
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of [...new Set(out.split("\0").filter(Boolean))].sort()) {
    hash.update(file).update("\0").update(fileState(join(root, file))).update("\0");
  }
  return hash.digest("hex");
}

// ls-files --cached still lists a tracked file deleted from the working tree, and lists a
// submodule or a symlink to a directory as one entry.
function fileState(full: string): string | Buffer {
  let stat;
  try {
    stat = lstatSync(full);
  } catch {
    return "missing";
  }
  if (stat.isSymbolicLink()) return `link:${readlinkSync(full)}`;
  if (stat.isDirectory()) return "dir";
  return Buffer.concat([Buffer.from("file:"), readFileSync(full)]);
}

/** True when a watched path differs from HEAD or is untracked. */
export function hasUncommittedChanges(tool: UiTool, root: string, config: Config): boolean {
  return git(root, ["status", "--porcelain", ...watchSpecs(tool, config)]).trim() !== "";
}
