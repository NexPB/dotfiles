import type { BrowserContext, Page as Tab } from "playwright";
import type { Config, Page } from "./config.ts";

export type PageRun = {
  config: Config;
  page: Page;
  url: URL;
  /** Whether a saved login session was loaded into the browser context. */
  hasAuth: boolean;
  /** Records a failure for this page. */
  fail: (issue: string) => void;
  /** Delays the page's result until `work` settles, for listeners that do async work. */
  defer: (work: Promise<unknown>) => void;
};

/**
 * One concern a UI run checks. Every hook is optional; the runner calls them in order for each
 * page: `setup` before the tab opens, `listen` before navigation, `inspect` after the page settles,
 * and `notes` last, for informational lines that never fail the page.
 */
export type Check = {
  setup?: (context: BrowserContext, run: PageRun) => Promise<void>;
  listen?: (tab: Tab, run: PageRun) => void;
  inspect?: (tab: Tab, run: PageRun) => Promise<void>;
  notes?: (tab: Tab, run: PageRun) => Promise<string[]>;
};

/** A verify tool for a browser UI: its name (`verify:<name>`), config defaults, and checks. */
export type UiTool = {
  name: string;
  defaults: Partial<Config>;
  checks: Check[];
};
