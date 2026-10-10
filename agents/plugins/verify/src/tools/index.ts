import type { UiTool } from "../ui/tool.ts";
import { shopifyAppUi } from "./shopify-app-ui.ts";

/** Every tool, keyed by the name in `verify:<name>`, `verify <name> …`, and `.verify/<name>.json`. */
export const tools: UiTool[] = [shopifyAppUi];
