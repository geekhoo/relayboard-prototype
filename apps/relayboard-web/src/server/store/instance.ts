import type { Store } from "#/server/store";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The one store this process has.
 *
 * Held on `globalThis` rather than in a module-level `const` for one reason: a dev server
 * reloads modules, and a module-scope store would hand every reload a fresh workspace — so
 * the product's central claim ("the message that arrived while you were away is still
 * there") would be false in development in a way it is not in production. `globalThis`
 * survives the reload, so the workspace does too, and one process serves one workspace.
 *
 * **This module is server-only.** Nothing under `src/routes` or `src/components` may import
 * it: the UI reaches data through `RelayboardClient`, and `biome.json`'s
 * `noRestrictedImports` rule makes the shortcut a lint failure (04a). That boundary is what
 * keeps 06b's session resolution and 08a's credentials on the server side of the seam.
 *
 * **It is in-memory and volatile.** It survives connection churn, multiple tabs and every
 * request this process serves; it does not survive a restart. The app says so where a
 * participant can read it (the workspace's own copy), and the deployment target is pinned
 * to `node-server` for the same reason: a serverless target would give every invocation its
 * own store, which is not this product.
 */

const STORE_KEY = Symbol.for("relayboard:store");

interface GlobalWithStore {
	[STORE_KEY]?: Store;
}

/** A brand-new workspace: the demo seed, its membership predicate and its watermarks. */
export const createSeedStore = (): Store =>
	createStore(demoSeed(), demoOptions());

/**
 * The process's store, created on first use.
 *
 * A getter rather than an exported value, so a test can reset it without the import having
 * already frozen an instance, and so importing this module never has a side effect.
 */
export const getStore = (): Store => {
	const globalStore = globalThis as GlobalWithStore;
	globalStore[STORE_KEY] ??= createSeedStore();
	return globalStore[STORE_KEY];
};

/**
 * Returns the process's store to a fresh seed, and hands it back.
 *
 * **Test and dev only.** This is the harness's hook — the route seam's between-test reset
 * (04c) and any test that wants a known workspace. It is *not* a participant operation: it is
 * absent from `RelayboardClient`, and the server function that exposes it refuses outside a
 * test/dev process.
 *
 * It is deliberately a different thing from the product's purge (14): a purge is
 * permission-checked, names what it will remove, requires confirmation and leaves the
 * reader's own records and identity alone. One is a development hook, the other is a product
 * action with a consequence, and neither may be reachable as the other.
 */
export const resetStore = (): Store => {
	const globalStore = globalThis as GlobalWithStore;
	globalStore[STORE_KEY] = createSeedStore();
	return globalStore[STORE_KEY];
};

/**
 * Whether this process may expose the reset hook.
 *
 * The one place that decision is made, so a route cannot make it differently: a production
 * build refuses unless the process explicitly declares itself a test mode. `RELAYBOARD_TEST_MODE`
 * exists because `next/nitro` builds run with `NODE_ENV=production` even when a harness is
 * driving them.
 */
export const resetAllowed = (
	source: Record<string, string | undefined> = process.env,
): boolean =>
	source.NODE_ENV !== "production" || source.RELAYBOARD_TEST_MODE === "1";
