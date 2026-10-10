#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gate } from "../lib/gate.mjs";
import { CONFIG_FILE, DEFAULTS, findRoot, loadConfig, paths } from "../lib/project.mjs";

const USAGE = `usage: verify <command>

  init               write ${CONFIG_FILE} and .verify/.gitignore in the current directory
  login              open a browser at baseUrl+loginPath; log in, close the window to save the session
  run [page...]      load each page, check errors and web components, diff screenshots
  approve [page...]  make the last run's screenshots the baselines (default: every new or changed page)
  gate               Claude Code Stop hook: block while UI changes have no passing run

exit codes: 0 pass, 1 fail, 2 usage or config error`;

const [command, ...args] = process.argv.slice(2);

try {
  process.exitCode = await main();
} catch (err) {
  console.error(`verify: ${err.message}`);
  // Exit 2 from a Stop hook blocks the stop, so a broken gate must not use it.
  process.exitCode = command === "gate" ? 1 : 2;
}

async function main() {
  if (command === "gate") return gate();
  if (command === "init") return init(process.cwd());
  if (!["run", "approve", "login"].includes(command)) {
    console.error(USAGE);
    return command === undefined || command === "help" || command === "--help" ? 0 : 2;
  }

  const root = findRoot(process.cwd());
  if (!root) throw new Error(`no ${CONFIG_FILE} here or above; run \`verify init\` in the app root`);
  const config = loadConfig(root);

  if (command === "login") return login(root, config);
  const { run, approve } = await import("../lib/run.mjs");
  return command === "run" ? run(root, config, args) : approve(root, config, args);
}

function init(root) {
  const configPath = join(root, CONFIG_FILE);
  if (existsSync(configPath)) throw new Error(`${CONFIG_FILE} already exists`);
  const { appBridgeStub, maxDiffPixels, ...starter } = DEFAULTS;
  starter.pages = [{ name: "home", path: "/" }];
  writeFileSync(configPath, JSON.stringify(starter, null, 2) + "\n");
  mkdirSync(join(root, ".verify"), { recursive: true });
  writeFileSync(join(root, ".verify", ".gitignore"), "out/\nauth.json\npass\n");
  console.log(`wrote ${CONFIG_FILE} and .verify/.gitignore; commit .verify/baseline/ once you approve screenshots`);
  return 0;
}

async function login(root, config) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: config.viewport });
  const page = await context.newPage();
  await page.goto(new URL(config.loginPath, config.baseUrl).href);
  console.log("log in, then close the browser window");
  await page.waitForEvent("close", { timeout: 0 });
  const { auth } = paths(root);
  mkdirSync(join(root, ".verify"), { recursive: true });
  await context.storageState({ path: auth });
  await browser.close();
  console.log(`saved session to .verify/auth.json`);
  return 0;
}
