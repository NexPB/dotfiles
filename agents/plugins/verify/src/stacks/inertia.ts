import type { Response } from "playwright";
import type { Check } from "../ui/tool.ts";

/** Inertia answers a stale asset version with 409 and the client reloads; not a failure. */
export const isVersionConflict = (res: Response) => res.status() === 409 && !!res.request().headers()["x-inertia"];

/** Fails when an Inertia visit gets a plain HTML or JSON answer, which Inertia shows in an error modal. */
export const protocol = (): Check => ({
  listen(tab, run) {
    tab.on("response", (res) => {
      const req = res.request();
      if (req.headers()["x-inertia"] && !res.headers()["x-inertia"] && res.status() < 300) {
        run.fail(`non-Inertia response to an Inertia visit: ${req.method()} ${res.url()}`);
      }
    });
  },
});
