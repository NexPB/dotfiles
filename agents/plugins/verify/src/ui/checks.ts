import type { Response } from "playwright";
import type { Check } from "./tool.ts";

export const firstLine = (err: unknown) => (err instanceof Error ? err.message : String(err)).split("\n")[0];

/** Fails on uncaught exceptions and `console.error`. */
export const jsErrors = (): Check => ({
  listen(tab, run) {
    tab.on("pageerror", (err) => run.fail(`js error: ${firstLine(err)}`));
    tab.on("console", (msg) => {
      // Chromium logs every 4xx/5xx as "Failed to load resource"; httpErrors and failedRequests own those.
      if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
        run.fail(`console error: ${firstLine(msg.text())}`);
      }
    });
  },
});

/** Fails on requests that never got a response; cancelled navigations and fetches are fine. */
export const failedRequests = (): Check => ({
  listen(tab, run) {
    tab.on("requestfailed", (req) => {
      const reason = req.failure()?.errorText ?? "";
      if (!reason.includes("ERR_ABORTED")) run.fail(`request failed: ${req.method()} ${req.url()} ${reason}`);
    });
  },
});

/**
 * Fails on 4xx/5xx responses from the app's own origin. `ignore` skips responses that are part of
 * a protocol; `describe` adds a detail, such as the exception a dev error page names.
 */
export const httpErrors = (opts: {
  ignore?: (res: Response) => boolean;
  describe?: (res: Response) => Promise<string | undefined>;
} = {}): Check => ({
  listen(tab, run) {
    const origin = new URL(run.config.baseUrl).origin;
    tab.on("response", (res) => {
      if (res.status() < 400 || !res.url().startsWith(origin) || opts.ignore?.(res)) return;
      const line = `HTTP ${res.status()}: ${res.request().method()} ${res.url()}`;
      if (!opts.describe) return run.fail(line);
      run.defer(
        opts
          .describe(res)
          .catch(() => undefined)
          .then((detail) => run.fail(detail ? `${line} (${detail})` : line)),
      );
    });
  },
});

/** Fails when the page lands on a different path, which usually means the session expired. */
export const redirects = (): Check => ({
  async inspect(tab, run) {
    const landed = new URL(tab.url());
    if (landed.pathname !== run.url.pathname) {
      const hint = run.hasAuth ? "session expired?" : "no saved session";
      run.fail(`redirected to ${landed.pathname} (${hint}: run \`verify ${run.tool.name} login\`)`);
    }
  },
});

const UPGRADE_TIMEOUT_MS = 5000;

/**
 * Fails on custom elements that are still undefined after a grace period: a misspelled tag, or a
 * component library that never loaded. `ignore` lists tag prefixes defined by scripts the run stubs.
 */
export const customElements = (opts: { ignore?: string[]; hint: string }): Check => ({
  async inspect(tab, run) {
    const undefinedTags = () =>
      tab.evaluate(
        (ignore) => [
          ...new Set(
            [...document.querySelectorAll("*")]
              .map((el) => el.localName)
              .filter((tag) => tag.includes("-") && !window.customElements.get(tag) && !ignore.some((p) => tag.startsWith(p))),
          ),
        ],
        opts.ignore ?? [],
      );
    const deadline = Date.now() + UPGRADE_TIMEOUT_MS;
    let tags = await undefinedTags();
    while (tags.length && Date.now() < deadline) {
      await tab.waitForTimeout(100);
      tags = await undefinedTags();
    }
    if (tags.length) run.fail(`unknown web components (${opts.hint}): <${tags.join(">, <")}>`);
  },
});
