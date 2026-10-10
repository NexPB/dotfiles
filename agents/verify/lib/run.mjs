import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { paths, treeHash } from "./project.mjs";

const STUB = fileURLToPath(new URL("./bridge-stub.js", import.meta.url));
const CONCURRENCY = 4;
const UPGRADE_TIMEOUT_MS = 5000;
const MAX_LINES_PER_PAGE = 6;

export async function run(root, config, only) {
  const p = paths(root);
  const pages = only.length ? config.pages.filter((page) => only.includes(page.name)) : config.pages;
  const unknown = only.filter((name) => !config.pages.some((page) => page.name === name));
  if (unknown.length) throw new Error(`unknown page: ${unknown.join(", ")}`);
  if (!pages.length) throw new Error(`no pages in verify.config.json`);

  const hash = treeHash(root, config);
  rmSync(p.stamp, { force: true });
  mkdirSync(p.out, { recursive: true });
  mkdirSync(p.baseline, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const results = [];
  try {
    const queue = [...pages];
    const worker = async () => {
      for (let page; (page = queue.shift()); ) results.push(await checkPage(browser, root, config, page));
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
  } finally {
    await browser.close();
  }
  results.sort((a, b) => pages.indexOf(a.page) - pages.indexOf(b.page));

  const report = {
    treeHash: hash,
    complete: !only.length,
    pages: results.map(({ page, ...r }) => ({ name: page.name, path: page.path, ...r })),
  };
  writeFileSync(join(p.out, "report.json"), JSON.stringify(report, null, 2));
  return finish(root, config, report);
}

/** Prints the report and writes the pass stamp when it is complete, green, and the tree is unchanged. */
export function finish(root, config, report) {
  const p = paths(root);
  const rel = (file) => relative(root, file);
  const failed = report.pages.filter((r) => r.issues.length || r.visual !== "match");

  for (const r of report.pages) {
    const ok = !r.issues.length && r.visual === "match";
    console.log(`${ok ? "✓" : "✗"} ${r.name} ${r.path}`);
    const lines = [...r.issues];
    if (r.visual === "new") lines.push(`no baseline: look at ${rel(r.shot)}, then \`verify approve ${r.name}\``);
    if (r.visual === "diff") lines.push(`${r.diffPixels} pixels differ from baseline: ${rel(r.diff)}`);
    if (r.visual === "size") lines.push(`size ${r.size} differs from baseline ${r.baselineSize}: ${rel(r.shot)}`);
    for (const line of lines.slice(0, MAX_LINES_PER_PAGE)) console.log(`    ${line}`);
    if (lines.length > MAX_LINES_PER_PAGE) console.log(`    … ${lines.length - MAX_LINES_PER_PAGE} more in ${rel(join(p.out, "report.json"))}`);
    if (r.bridgeCalls?.length) console.log(`    app bridge: ${r.bridgeCalls.map((c) => c.call).join(", ")}`);
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

async function checkPage(browser, root, config, page) {
  const p = paths(root);
  const issues = [];
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
  tab.on("pageerror", (err) => issues.push(`js error: ${err.message.split("\n")[0]}`));
  tab.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`console error: ${msg.text().split("\n")[0]}`);
  });
  tab.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "";
    if (!reason.includes("ERR_ABORTED")) issues.push(`request failed: ${req.method()} ${req.url()} ${reason}`);
  });
  tab.on("response", async (res) => {
    const req = res.request();
    // Inertia answers a stale asset version with 409 and reloads; that is not a failure.
    if (res.status() >= 400 && res.status() !== 409 && res.url().startsWith(origin)) {
      issues.push(`HTTP ${res.status()}: ${req.method()} ${res.url()}`);
    }
    if (req.headers()["x-inertia"] && !res.headers()["x-inertia"] && res.status() < 300) {
      issues.push(`non-Inertia response to an Inertia visit: ${req.method()} ${res.url()}`);
    }
  });

  const url = new URL(page.path, config.baseUrl);
  try {
    await tab.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
    const landed = new URL(tab.url());
    if (landed.pathname !== url.pathname) {
      issues.push(`redirected to ${landed.pathname}${existsSync(p.auth) ? "" : " (no saved session: run `verify login`)"}`);
    }
    if (page.waitFor) await tab.locator(page.waitFor).first().waitFor({ timeout: 10_000 });
    await tab.evaluate(() => document.fonts.ready);
    const undefinedTags = await waitForUpgrade(tab, config.appBridgeStub);
    if (undefinedTags.length) issues.push(`unknown web components (typo, or polaris.js not loaded): <${undefinedTags.join(">, <")}>`);
  } catch (err) {
    issues.push(`load: ${err.message.split("\n")[0]}`);
  }

  const shot = join(p.out, `${page.name}.png`);
  let visual = "skipped";
  let extra = {};
  try {
    await tab.screenshot({
      path: shot,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      mask: (page.mask ?? []).map((sel) => tab.locator(sel)),
    });
    ({ visual, ...extra } = compare(shot, join(p.baseline, `${page.name}.png`), join(p.out, `${page.name}.diff.png`), page.maxDiffPixels ?? config.maxDiffPixels));
  } catch (err) {
    issues.push(`screenshot: ${err.message.split("\n")[0]}`);
  }

  const bridgeCalls = config.appBridgeStub ? await tab.evaluate(() => window.__verifyBridgeCalls ?? []).catch(() => []) : [];
  await context.close();
  return { page, issues: [...new Set(issues)], visual, shot, bridgeCalls, ...extra };
}

/** Returns the custom-element tags still undefined once Polaris has had time to register its components. */
async function waitForUpgrade(tab, bridgeStubbed) {
  const pending = () =>
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
  let tags = await pending();
  while (tags.length && Date.now() < deadline) {
    await tab.waitForTimeout(100);
    tags = await pending();
  }
  return tags;
}

function compare(shot, baseline, diffPath, maxPixels) {
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
export function approve(root, config, names) {
  const p = paths(root);
  const reportPath = join(p.out, "report.json");
  if (!existsSync(reportPath)) throw new Error("no report: run `verify run` first");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const targets = report.pages.filter((r) => (names.length ? names.includes(r.name) : r.visual !== "match" && r.visual !== "skipped"));
  for (const r of targets) {
    if (!existsSync(r.shot)) throw new Error(`no screenshot for ${r.name}`);
    copyFileSync(r.shot, join(p.baseline, `${r.name}.png`));
    r.visual = "match";
    console.log(`approved ${r.name}`);
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log();
  return finish(root, config, report);
}
