import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import pixelmatch from "pixelmatch";
import type { Browser } from "playwright";
import { PNG } from "pngjs";
import { firstLine } from "./checks.ts";
import { configFile, paths, treeHash, type Config, type Page } from "./config.ts";
import type { PageRun, UiTool } from "./tool.ts";

const CONCURRENCY = 4;
const MAX_LINES_PER_PAGE = 6;

type Visual =
  | { visual: "match" | "new" | "skipped" }
  | { visual: "size"; size: string; baselineSize: string }
  | { visual: "diff"; diffPixels: number; diff: string };

type PageResult = Visual & { name: string; path: string; issues: string[]; notes: string[]; shot: string };

type Report = { treeHash: string; complete: boolean; pages: PageResult[] };

export async function run(tool: UiTool, root: string, config: Config, only: string[]): Promise<number> {
  const p = paths(tool, root);
  const unknown = only.filter((name) => !config.pages.some((page) => page.name === name));
  if (unknown.length) throw new Error(`unknown page: ${unknown.join(", ")}`);
  const pages = only.length ? config.pages.filter((page) => only.includes(page.name)) : config.pages;
  if (!pages.length) throw new Error(`no pages in ${configFile(tool)}`);

  const hash = treeHash(tool, root, config);
  rmSync(p.stamp, { force: true });
  mkdirSync(p.out, { recursive: true });
  mkdirSync(p.baseline, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const results: PageResult[] = [];
  try {
    const queue = [...pages];
    const worker = async () => {
      for (let page; (page = queue.shift()); ) results.push(await checkPage(tool, browser, root, config, page));
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
  } finally {
    await browser.close();
  }
  const order = pages.map((page) => page.name);
  results.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const report: Report = { treeHash: hash, complete: !only.length, pages: results };
  writeFileSync(join(p.out, "report.json"), JSON.stringify(report, null, 2));
  return finish(tool, root, config, report);
}

/** Prints the report and writes the pass stamp when it is complete, green, and the tree is unchanged. */
function finish(tool: UiTool, root: string, config: Config, report: Report): number {
  const p = paths(tool, root);
  const rel = (file: string) => relative(root, file);
  const failed = report.pages.filter((r) => r.issues.length || r.visual !== "match");

  for (const r of report.pages) {
    const ok = !r.issues.length && r.visual === "match";
    console.log(`${ok ? "✓" : "✗"} ${r.name} ${r.path}`);
    const lines = [...r.issues];
    if (r.visual === "new") lines.push(`no baseline: look at ${rel(r.shot)}, then \`verify ${tool.name} approve ${r.name}\``);
    if (r.visual === "diff") lines.push(`${r.diffPixels} pixels differ from baseline: ${rel(r.diff)}`);
    if (r.visual === "size") lines.push(`size ${r.size} differs from baseline ${r.baselineSize}: ${rel(r.shot)}`);
    for (const line of lines.slice(0, MAX_LINES_PER_PAGE)) console.log(`    ${line}`);
    if (lines.length > MAX_LINES_PER_PAGE) console.log(`    … ${lines.length - MAX_LINES_PER_PAGE} more in ${rel(join(p.out, "report.json"))}`);
    for (const note of r.notes) console.log(`    ${note}`);
  }

  const passed = !failed.length;
  if (passed && report.complete && report.treeHash === treeHash(tool, root, config)) {
    writeFileSync(p.stamp, report.treeHash + "\n");
    console.log(`\npass: ${report.pages.length} pages`);
  } else if (passed) {
    console.log(`\npass, not stamped: ${report.complete ? "files changed during the run" : "run without page filter to stamp"}`);
  } else {
    console.log(`\nfail: ${failed.length}/${report.pages.length} pages. Screenshots in ${rel(p.out)}/`);
  }
  return passed ? 0 : 1;
}

async function checkPage(tool: UiTool, browser: Browser, root: string, config: Config, page: Page): Promise<PageResult> {
  const p = paths(tool, root);
  const issues: string[] = [];
  const deferred: Promise<unknown>[] = [];
  const hasAuth = existsSync(p.auth);
  const ctx: PageRun = {
    config,
    page,
    url: new URL(page.path, config.baseUrl),
    hasAuth,
    fail: (issue) => issues.push(issue),
    defer: (work) => deferred.push(work),
  };

  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    storageState: hasAuth ? p.auth : undefined,
  });
  for (const check of tool.checks) await check.setup?.(context, ctx);
  const tab = await context.newPage();
  for (const check of tool.checks) check.listen?.(tab, ctx);

  try {
    await tab.goto(ctx.url.href, { waitUntil: "networkidle", timeout: 30_000 });
    if (page.waitFor) await tab.locator(page.waitFor).first().waitFor({ timeout: 10_000 });
    await tab.evaluate(() => document.fonts.ready);
    for (const check of tool.checks) await check.inspect?.(tab, ctx);
  } catch (err) {
    ctx.fail(`load: ${firstLine(err)}`);
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
    ctx.fail(`screenshot: ${firstLine(err)}`);
  }

  const notes: string[] = [];
  for (const check of tool.checks) notes.push(...((await check.notes?.(tab, ctx).catch(() => [])) ?? []));
  await Promise.all(deferred);
  await context.close();
  return { name: page.name, path: page.path, issues: [...new Set(issues)], notes, shot, ...visual };
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
export function approve(tool: UiTool, root: string, config: Config, names: string[]): number {
  const p = paths(tool, root);
  const reportPath = join(p.out, "report.json");
  if (!existsSync(reportPath)) throw new Error(`no report: run \`verify ${tool.name} run\` first`);
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
  return finish(tool, root, config, report);
}
