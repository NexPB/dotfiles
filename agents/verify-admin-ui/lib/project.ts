import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const NAME = "verify-admin-ui";
export const CONFIG_FILE = ".verify/admin-ui.json";

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
  appBridgeStub: boolean;
  maxDiffPixels: number;
  pages: Page[];
};

export const DEFAULTS: Config = {
  baseUrl: "http://localhost:4000",
  loginPath: "/",
  viewport: { width: 1280, height: 900 },
  // Git pathspecs: `*` crosses `/`, so `lib/*_web/*` is the whole web layer and nothing else in lib.
  watch: ["assets/js", "assets/css", "lib/*_web/*", "lib/*_web.ex"],
  appBridgeStub: true,
  maxDiffPixels: 0,
  pages: [],
};

/** Walks up from `start` to the nearest directory holding .verify/admin-ui.json; null when there is none. */
export function findRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(root: string): Config {
  const raw = JSON.parse(readFileSync(join(root, CONFIG_FILE), "utf8"));
  const config: Config = { ...DEFAULTS, ...raw, viewport: { ...DEFAULTS.viewport, ...raw.viewport } };
  for (const page of config.pages) {
    if (!page.name || !page.path) throw new Error(`each page needs "name" and "path": ${JSON.stringify(page)}`);
  }
  return config;
}

export const paths = (root: string) => {
  const dir = join(root, ".verify", "admin-ui");
  return {
    dir,
    auth: join(dir, "auth.json"),
    stamp: join(dir, "pass"),
    baseline: join(dir, "baseline"),
    out: join(dir, "out"),
  };
};

function git(root: string, args: string[]): string {
  const proc = Bun.spawnSync(["git", ...args], { cwd: root, stderr: "pipe" });
  if (!proc.success) throw new Error(`git ${args[0]}: ${proc.stderr.toString().trim()}`);
  return proc.stdout.toString();
}

function watchedFiles(root: string, config: Config): string[] {
  const out = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", CONFIG_FILE, ...config.watch]);
  return [...new Set(out.split("\0").filter(Boolean))].sort();
}

/** sha256 over the path and content of every watched file, committed or not. */
export function treeHash(root: string, config: Config): string {
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of watchedFiles(root, config)) {
    const full = join(root, file);
    hash.update(file).update("\0");
    // ls-files --cached still lists a tracked file deleted from the working tree.
    if (existsSync(full)) hash.update(readFileSync(full));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** True when a watched path differs from HEAD or is untracked. */
export function hasUncommittedChanges(root: string, config: Config): boolean {
  return git(root, ["status", "--porcelain", "--", CONFIG_FILE, ...config.watch]).trim() !== "";
}
