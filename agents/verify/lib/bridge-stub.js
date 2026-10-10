// Injected before any page script. Stands in for App Bridge's `window.shopify` outside the admin
// and records every call into `window.__verifyBridgeCalls`.
(() => {
  const calls = (window.__verifyBridgeCalls = []);
  const node = (path) =>
    new Proxy(function () {}, {
      get(_, key) {
        if (key === "then") return undefined;
        if (key === Symbol.toPrimitive) return () => path;
        if (path === "shopify" && key === "config") return { apiKey: "verify", shop: "verify.myshopify.com" };
        return node(`${path}.${String(key)}`);
      },
      apply(_, __, args) {
        let recorded;
        try {
          recorded = JSON.parse(JSON.stringify(args));
        } catch {
          recorded = args.map(String);
        }
        calls.push({ call: path, args: recorded });
        if (path === "shopify.idToken") return Promise.resolve("verify-id-token");
        return Promise.resolve(undefined);
      },
    });
  Object.defineProperty(window, "shopify", { value: node("shopify"), configurable: false, writable: false });
})();
