// Injected before any page script. Stands in for App Bridge's `window.shopify` outside the admin
// and records every call into `window.__verifyBridgeCalls`.
(() => {
  const calls = (window.__verifyBridgeCalls = []);
  const record = (path, args) => {
    let recorded;
    try {
      recorded = JSON.parse(JSON.stringify(args));
    } catch {
      recorded = args.map(String);
    }
    calls.push({ call: path, args: recorded });
  };

  // Plain values for the members apps read as data or await for data; everything else is an API
  // that the stub records and resolves with undefined.
  const fixed = {
    config: { apiKey: "verify", shop: "verify.myshopify.com", locale: "en" },
    environment: { embedded: false, mobile: false, pos: false },
    origin: "https://admin.shopify.com",
    idToken: () => Promise.resolve("verify-id-token"),
    user: () => Promise.resolve({ id: 1, name: "Verify", email: "verify@example.com", accountAccess: "Account owner" }),
  };
  // Keys JS machinery reads on any object; answering them with an API proxy breaks JSON,
  // promises, iteration and string conversion.
  const absent = new Set(["then", "toJSON", "constructor", "prototype", "valueOf", "inspect"]);

  const api = (path) =>
    new Proxy(function () {}, {
      get(_, key) {
        if (typeof key === "symbol") return key === Symbol.toPrimitive ? () => path : undefined;
        if (absent.has(key)) return undefined;
        if (key === "toString") return () => path;
        return api(`${path}.${key}`);
      },
      has: () => true,
      apply(_, __, args) {
        record(path, args);
        return Promise.resolve(undefined);
      },
    });

  const shopify = new Proxy(
    {},
    {
      get(_, key) {
        if (typeof key === "symbol" || absent.has(key)) return undefined;
        if (key in fixed) {
          const value = fixed[key];
          return typeof value === "function" ? (...args) => (record(`shopify.${key}`, args), value(...args)) : value;
        }
        return api(`shopify.${key}`);
      },
      has: () => true,
    },
  );
  Object.defineProperty(window, "shopify", { value: shopify, configurable: false, writable: false });
})();
