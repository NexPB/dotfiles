import type { Response } from "playwright";
import type { Config } from "../ui/config.ts";

export const defaults: Partial<Config> = {
  baseUrl: "http://localhost:4000",
  // Git pathspecs: `*` crosses `/`, so `lib/*_web/*` is the whole web layer and nothing else in lib.
  watch: ["assets/js", "assets/css", "lib/*_web/*", "lib/*_web.ex"],
};

/** The exception Plug.Debugger's dev error page names in its title, e.g. "KeyError at GET /app". */
export async function errorTitle(res: Response): Promise<string | undefined> {
  return (await res.text()).match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || undefined;
}
