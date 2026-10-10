import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CONFIG_FILE = "verify.config.json";

export const DEFAULTS = {
  baseUrl: "http://localhost:8000",
  loginPath: "/",
  viewport: { width: 1280, height: 900 },
  watch: ["resources/js", "resources/css", "resources/views"],
  appBridgeStub: true,
  maxDiffPixels: 0,
  pages: [],
};

/** Walks up from `start` to the nearest directory holding verify.config.json; null when there is none. */
export function findRoot(start) {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(root) {
  const raw = JSON.parse(readFileSync(join(root, CONFIG_FILE), "utf8"));
  const config = { ...DEFAULTS, ...raw, viewport: { ...DEFAULTS.viewport, ...raw.viewport } };
  for (const page of config.pages) {
    if (!page.name || !page.path) throw new Error(`each page needs "name" and "path": ${JSON.stringify(page)}`);
  }
  return config;
}

export const paths = (root) => ({
  dir: join(root, ".verify"),
  auth: join(root, ".verify", "auth.json"),
  stamp: join(root, ".verify", "pass"),
  baseline: join(root, ".verify", "baseline"),
  out: join(root, ".verify", "out"),
});

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function watchedFiles(root, config) {
  const out = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", CONFIG_FILE, ...config.watch]);
  return [...new Set(out.split("\0").filter(Boolean))].sort();
}

/** sha256 over the path and content of every watched file, committed or not. */
export function treeHash(root, config) {
  const hash = createHash("sha256");
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
export function hasUncommittedChanges(root, config) {
  return git(root, ["status", "--porcelain", "--", CONFIG_FILE, ...config.watch]).trim() !== "";
}
