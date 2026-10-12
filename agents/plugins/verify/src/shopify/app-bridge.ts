import { join } from "node:path";
import type { Check } from "../ui/tool.ts";

const STUB = join(import.meta.dir, "bridge-stub.js");

/** Tags app-bridge.js defines; undefined under the stub. */
export const ELEMENT_PREFIXES = ["ui-"];

/**
 * Replaces App Bridge with a stub so the app runs outside the Shopify admin, and lists the
 * `shopify.*` calls each page made.
 */
export const appBridge = (): Check => ({
  async setup(context) {
    await context.addInitScript({ path: STUB });
    await context.route(/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js/, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    );
  },
  async notes(tab) {
    const calls: { call: string }[] = await tab.evaluate(() => (window as any).__verifyBridgeCalls ?? []);
    return calls.length ? [`app bridge: ${calls.map((c) => c.call).join(", ")}`] : [];
  },
});
