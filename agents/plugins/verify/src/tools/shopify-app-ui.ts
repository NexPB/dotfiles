import * as appBridge from "../shopify/app-bridge.ts";
import * as inertia from "../stacks/inertia.ts";
import * as phoenix from "../stacks/phoenix.ts";
import { customElements, failedRequests, httpErrors, jsErrors, redirects } from "../ui/checks.ts";
import type { UiTool } from "../ui/tool.ts";

/** The embedded admin UI of a Shopify app on Phoenix and Inertia, through its standalone (non-iframe) view. */
export const shopifyAppUi: UiTool = {
  name: "shopify-app-ui",
  defaults: phoenix.defaults,
  checks: [
    appBridge.appBridge(),
    jsErrors(),
    failedRequests(),
    httpErrors({ ignore: inertia.isVersionConflict, describe: phoenix.errorTitle }),
    inertia.protocol(),
    redirects("run `verify shopify-app-ui login`"),
    customElements({ ignore: appBridge.ELEMENT_PREFIXES, hint: "typo in an <s-*> tag, or polaris.js not loaded" }),
  ],
};
