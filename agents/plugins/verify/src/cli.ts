import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tools } from "./tools/index.ts";
import { configFile, findRoot, loadConfig, paths, starterConfig, type Config } from "./ui/config.ts";
import { gate } from "./ui/gate.ts";
import type { UiTool } from "./ui/tool.ts";

const USAGE = `usage: verify <tool> <command>
       verify gate

tools: ${tools.map((t) => t.name).join(", ")}

  init               write .verify/<tool>.json and .verify/<tool>/.gitignore in the current directory
  login              open a browser at baseUrl+loginPath; log in, close the window to save the session
  run [page...]      load each page, run the tool's checks, diff screenshots
  approve [page...]  make the last run's screenshots the baselines (default: every new or changed page)

  gate               Claude Code Stop hook: block while any tool's watched files have no passing run

exit codes: 0 pass, 1 fail, 2 usage or config error`;

const [first, command, ...args] = process.argv.slice(2);

try {
  process.exitCode = await main();
} catch (err) {
  console.error(`verify: ${(err as Error).message}`);
  // Exit 2 from a Stop hook blocks the stop, so a broken gate must not use it.
  process.exitCode = first === "gate" ? 1 : 2;
}

async function main(): Promise<number> {
  if (first === "gate") return gate(tools);
  const tool = tools.find((t) => t.name === first);
  if (!tool || !["init", "login", "run", "approve"].includes(command ?? "")) {
    console.error(USAGE);
    return first === undefined || first === "help" || first === "--help" ? 0 : 2;
  }
  if (command === "init") return init(tool, process.cwd());

  const root = findRoot(tool, process.cwd());
  if (!root) throw new Error(`no ${configFile(tool)} here or above; run \`verify ${tool.name} init\` in the app root`);
  const config = loadConfig(tool, root);
  if (command === "login") return login(tool, root, config);
  const { run, approve } = await import("./ui/runner.ts");
  return command === "run" ? run(tool, root, config, args) : approve(tool, root, config, args);
}

function init(tool: UiTool, root: string): number {
  const file = configFile(tool);
  if (existsSync(join(root, file))) throw new Error(`${file} already exists`);
  const { maxDiffPixels, ...starter } = starterConfig(tool);
  const { dir } = paths(tool, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, file), JSON.stringify(starter, null, 2) + "\n");
  writeFileSync(join(dir, ".gitignore"), "out/\nauth.json\npass\n");
  console.log(`wrote ${file} and .verify/${tool.name}/.gitignore; commit .verify/${tool.name}/baseline/ once you approve screenshots`);
  return 0;
}

async function login(tool: UiTool, root: string, config: Config): Promise<number> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: config.viewport });
  const page = await context.newPage();
  await page.goto(new URL(config.loginPath, config.baseUrl).href);
  console.log("log in, then close the browser window");
  await page.waitForEvent("close", { timeout: 0 });
  const { dir, auth } = paths(tool, root);
  mkdirSync(dir, { recursive: true });
  await context.storageState({ path: auth });
  await browser.close();
  console.log(`saved session to .verify/${tool.name}/auth.json`);
  return 0;
}
