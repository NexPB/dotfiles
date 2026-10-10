import { existsSync, readFileSync } from "node:fs";
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

/** The config `init` writes: base values overlaid with the tool's defaults. */
export function starterConfig(tool: UiTool): Config {
  return { ...BASE, ...tool.defaults, pages: [{ name: "home", path: "/" }] };
}

export function loadConfig(tool: UiTool, root: string): Config {
  const raw = JSON.parse(readFileSync(join(root, configFile(tool)), "utf8"));
  const defaults = { ...BASE, ...tool.defaults };
  const config: Config = { ...defaults, ...raw, viewport: { ...defaults.viewport, ...raw.viewport } };
  for (const page of config.pages) {
    if (!page.name || !page.path) throw new Error(`each page needs "name" and "path": ${JSON.stringify(page)}`);
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
    const full = join(root, file);
    hash.update(file).update("\0");
    // ls-files --cached still lists a tracked file deleted from the working tree.
    if (existsSync(full)) hash.update(readFileSync(full));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** True when a watched path differs from HEAD or is untracked. */
export function hasUncommittedChanges(tool: UiTool, root: string, config: Config): boolean {
  return git(root, ["status", "--porcelain", ...watchSpecs(tool, config)]).trim() !== "";
}
