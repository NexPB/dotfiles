import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import pixelmatch from "pixelmatch";
import type { Browser, Page as Tab } from "playwright";
import { PNG } from "pngjs";
import { NAME, paths, treeHash, type Config, type Page } from "./project.ts";

const STUB = join(import.meta.dir, "bridge-stub.js");
const CONCURRENCY = 4;
const UPGRADE_TIMEOUT_MS = 5000;
const MAX_LINES_PER_PAGE = 6;

type Visual =
  | { visual: "match" | "new" | "skipped" }
  | { visual: "size"; size: string; baselineSize: string }
  | { visual: "diff"; diffPixels: number; diff: string };

type PageResult = Visual & {
  name: string;
  path: string;
  issues: string[];
  shot: string;
  bridgeCalls: { call: string; args: unknown[] }[];
};

type Report = { treeHash: string; complete: boolean; pages: PageResult[] };

export async function run(root: string, config: Config, only: string[]): Promise<number> {
  const p = paths(root);
  const unknown = only.filter((name) => !config.pages.some((page) => page.name === name));
  if (unknown.length) throw new Error(`unknown page: ${unknown.join(", ")}`);
  const pages = only.length ? config.pages.filter((page) => only.includes(page.name)) : config.pages;
  if (!pages.length) throw new Error(`no pages in .verify/admin-ui.json`);

  const hash = treeHash(root, config);
  rmSync(p.stamp, { force: true });
  mkdirSync(p.out, { recursive: true });
  mkdirSync(p.baseline, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const results: PageResult[] = [];
  try {
    const queue = [...pages];
    const worker = async () => {
      for (let page; (page = queue.shift()); ) results.push(await checkPage(browser, root, config, page));
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
  } finally {
    await browser.close();
  }
  const order = pages.map((page) => page.name);
  results.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const report: Report = { treeHash: hash, complete: !only.length, pages: results };
  writeFileSync(join(p.out, "report.json"), JSON.stringify(report, null, 2));
  return finish(root, config, report);
}

/** Prints the report and writes the pass stamp when it is complete, green, and the tree is unchanged. */
function finish(root: string, config: Config, report: Report): number {
  const p = paths(root);
  const rel = (file: string) => relative(root, file);
  const failed = report.pages.filter((r) => r.issues.length || r.visual !== "match");

  for (const r of report.pages) {
    const ok = !r.issues.length && r.visual === "match";
    console.log(`${ok ? "✓" : "✗"} ${r.name} ${r.path}`);
    const lines = [...r.issues];
    if (r.visual === "new") lines.push(`no baseline: look at ${rel(r.shot)}, then \`${NAME} approve ${r.name}\``);
    if (r.visual === "diff") lines.push(`${r.diffPixels} pixels differ from baseline: ${rel(r.diff)}`);
    if (r.visual === "size") lines.push(`size ${r.size} differs from baseline ${r.baselineSize}: ${rel(r.shot)}`);
    for (const line of lines.slice(0, MAX_LINES_PER_PAGE)) console.log(`    ${line}`);
    if (lines.length > MAX_LINES_PER_PAGE) console.log(`    … ${lines.length - MAX_LINES_PER_PAGE} more in ${rel(join(p.out, "report.json"))}`);
    if (r.bridgeCalls.length) console.log(`    app bridge: ${r.bridgeCalls.map((c) => c.call).join(", ")}`);
  }

  const passed = !failed.length;
  if (passed && report.complete && report.treeHash === treeHash(root, config)) {
    writeFileSync(p.stamp, report.treeHash + "\n");
    console.log(`\npass: ${report.pages.length} pages`);
  } else if (passed) {
    console.log(`\npass, not stamped: ${report.complete ? "files changed during the run" : "run without page filter to stamp"}`);
  } else {
    console.log(`\nfail: ${failed.length}/${report.pages.length} pages. Screenshots in ${rel(p.out)}/`);
  }
  return passed ? 0 : 1;
}

const firstLine = (err: unknown) => (err instanceof Error ? err.message : String(err)).split("\n")[0];

async function checkPage(browser: Browser, root: string, config: Config, page: Page): Promise<PageResult> {
  const p = paths(root);
  const issues: string[] = [];
  const pending: Promise<unknown>[] = [];
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    storageState: existsSync(p.auth) ? p.auth : undefined,
  });
  if (config.appBridgeStub) {
    await context.addInitScript({ path: STUB });
    await context.route(/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js/, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    );
  }

  const tab = await context.newPage();
  const origin = new URL(config.baseUrl).origin;
  tab.on("pageerror", (err) => issues.push(`js error: ${firstLine(err)}`));
  tab.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`console error: ${firstLine(msg.text())}`);
  });
  tab.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "";
    if (!reason.includes("ERR_ABORTED")) issues.push(`request failed: ${req.method()} ${req.url()} ${reason}`);
  });
  tab.on("response", (res) => {
    const req = res.request();
    const status = res.status();
    // Inertia answers a stale asset version with 409 and reloads; that is not a failure.
    if (status >= 400 && status !== 409 && res.url().startsWith(origin)) {
      const line = `HTTP ${status}: ${req.method()} ${res.url()}`;
      // Plug.Debugger titles its dev error page "<Exception> at <METHOD> <path>".
      pending.push(
        res
          .text()
          .then((body) => body.match(/<title>([^<]*)<\/title>/)?.[1]?.trim())
          .catch(() => undefined)
          .then((title) => issues.push(title ? `${line} (${title})` : line)),
      );
    }
    if (req.headers()["x-inertia"] && !res.headers()["x-inertia"] && status < 300) {
      issues.push(`non-Inertia response to an Inertia visit: ${req.method()} ${res.url()}`);
    }
  });

  const url = new URL(page.path, config.baseUrl);
  try {
    await tab.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
    const landed = new URL(tab.url());
    if (landed.pathname !== url.pathname) {
      issues.push(`redirected to ${landed.pathname}${existsSync(p.auth) ? "" : ` (no saved session: run \`${NAME} login\`)`}`);
    }
    if (page.waitFor) await tab.locator(page.waitFor).first().waitFor({ timeout: 10_000 });
    await tab.evaluate(() => document.fonts.ready);
    const undefinedTags = await waitForUpgrade(tab, config.appBridgeStub);
    if (undefinedTags.length) issues.push(`unknown web components (typo, or polaris.js not loaded): <${undefinedTags.join(">, <")}>`);
  } catch (err) {
    issues.push(`load: ${firstLine(err)}`);
  }

  const shot = join(p.out, `${page.name}.png`);
  let visual: Visual = { visual: "skipped" };
  try {
    await tab.screenshot({
      path: shot,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      mask: (page.mask ?? []).map((sel) => tab.locator(sel)),
    });
    visual = compare(shot, join(p.baseline, `${page.name}.png`), join(p.out, `${page.name}.diff.png`), page.maxDiffPixels ?? config.maxDiffPixels);
  } catch (err) {
    issues.push(`screenshot: ${firstLine(err)}`);
  }

  const bridgeCalls = config.appBridgeStub
    ? await tab.evaluate(() => (window as any).__verifyBridgeCalls ?? []).catch(() => [])
    : [];
  await Promise.all(pending);
  await context.close();
  return { name: page.name, path: page.path, issues: [...new Set(issues)], shot, bridgeCalls, ...visual };
}

/** Returns the custom-element tags still undefined once Polaris has had time to register its components. */
async function waitForUpgrade(tab: Tab, bridgeStubbed: boolean): Promise<string[]> {
  const undefinedTags = () =>
    tab.evaluate(
      // The stubbed app-bridge.js never defines its <ui-*> elements.
      (skipUi) => [
        ...new Set(
          [...document.querySelectorAll("*")]
            .map((el) => el.localName)
            .filter((tag) => tag.includes("-") && !customElements.get(tag) && !(skipUi && tag.startsWith("ui-"))),
        ),
      ],
      bridgeStubbed,
    );
  const deadline = Date.now() + UPGRADE_TIMEOUT_MS;
  let tags = await undefinedTags();
  while (tags.length && Date.now() < deadline) {
    await tab.waitForTimeout(100);
    tags = await undefinedTags();
  }
  return tags;
}

function compare(shot: string, baseline: string, diffPath: string, maxPixels: number): Visual {
  rmSync(diffPath, { force: true });
  if (!existsSync(baseline)) return { visual: "new" };
  const actual = PNG.sync.read(readFileSync(shot));
  const expected = PNG.sync.read(readFileSync(baseline));
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return { visual: "size", size: `${actual.width}x${actual.height}`, baselineSize: `${expected.width}x${expected.height}` };
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const pixels = pixelmatch(expected.data, actual.data, diff.data, actual.width, actual.height, { threshold: 0.1 });
  if (pixels <= maxPixels) return { visual: "match" };
  writeFileSync(diffPath, PNG.sync.write(diff));
  return { visual: "diff", diffPixels: pixels, diff: diffPath };
}

/** Promotes the last run's screenshots to baselines; with no names, every page that was new or differed. */
export function approve(root: string, config: Config, names: string[]): number {
  const p = paths(root);
  const reportPath = join(p.out, "report.json");
  if (!existsSync(reportPath)) throw new Error(`no report: run \`${NAME} run\` first`);
  const report: Report = JSON.parse(readFileSync(reportPath, "utf8"));
  report.pages = report.pages.map((r) => {
    const target = names.length ? names.includes(r.name) : r.visual !== "match" && r.visual !== "skipped";
    if (!target) return r;
    if (!existsSync(r.shot)) throw new Error(`no screenshot for ${r.name}`);
    copyFileSync(r.shot, join(p.baseline, `${r.name}.png`));
    console.log(`approved ${r.name}`);
    return { ...r, visual: "match" };
  });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log();
  return finish(root, config, report);
}
