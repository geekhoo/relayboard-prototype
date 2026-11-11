import { defineConfig } from "vitest/config";

/**
 * The test harness for the domain and the store.
 *
 * Deliberately separate from `vite.config.ts`: that config loads the four plugins
 * the app builds with (Nitro, Tailwind, TanStack Start, React), and none of them
 * belongs in a Node test run. `vitest.config.ts` replaces it rather than merging
 * with it, so a test run cannot pick up a preset, a dev server or a React
 * transform by accident.
 *
 * No `test.globals`: every test imports `describe`, `it` and `expect` from
 * `vitest` explicitly, so a test file reads the same whether Vitest or `tsc` is
 * the thing looking at it, and no ambient `globals.d.ts` has to be kept in step.
 *
 * `environment: "node"` is the whole point of the ticket: the store and the domain
 * are plain TypeScript with no DOM, so the suite runs in Node with no DOM
 * implementation installed and no browser driven. A test that needs `document`
 * fails here rather than quietly passing in a simulated one.
 */
export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		// A test may not reach the network, so a suite that hangs is a failure, not
		// a slow pass. The budget is per test, not per file.
		testTimeout: 5000,
	},
});
