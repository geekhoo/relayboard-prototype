import { describe, expect, it } from "vitest";
import {
	createSeedStore,
	getStore,
	resetAllowed,
	resetStore,
} from "#/server/store/instance";

/**
 * The store's lifetime, asserted at the store seam.
 *
 * Three claims, and each is the one 06a makes in a criterion:
 *
 * 1. **One store per process.** Every call to `getStore()` returns the same instance, so two
 *    requests share a workspace rather than each getting their own.
 * 2. **Constructing a second context starts from the seed again** — asserted here the way the
 *    ticket asks, "at the store level rather than by killing a process".
 * 3. **The reset hook is test/dev only**, and it is not the product's purge.
 *
 * What is *not* here is a test of the server functions themselves. `createServerFn` resolves
 * through a request-scoped Start context that a bare `vitest run` does not have — calling one
 * throws "No Start context found in AsyncLocalStorage". Fabricating that context would test
 * the fabrication rather than the app, so the reachability of each read is asserted over HTTP
 * against a served build instead, which is the path a client actually takes; 06c and 04c carry
 * that assertion. See the ticket's Comments.
 */

describe("the store instance", () => {
	it("is one store for the whole process", () => {
		const first = getStore();
		const second = getStore();

		// Identity, not equality: two calls hand back the same workspace, so a post made
		// through one is visible through the other.
		expect(second).toBe(first);
	});

	it("survives being asked for across separate modules of the same process", async () => {
		const fromThisModule = getStore();
		// A dynamic import resolves the same module instance here, but the property that
		// matters is the one a dev-server reload exercises: the store lives on `globalThis`,
		// so a fresh module instance would still find it. Asserted by reading the global the
		// module documents rather than by pretending to reload.
		const { getStore: getStoreAgain } = await import("#/server/store/instance");
		expect(getStoreAgain()).toBe(fromThisModule);
		expect(
			(globalThis as unknown as Record<symbol, unknown>)[
				Symbol.for("relayboard:store")
			],
		).toBe(fromThisModule);
	});

	it("carries what one request wrote into the next", () => {
		const store = getStore();
		const before = store.readEntries("delivery").length;

		store.appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "Written by one request, read by the next.",
		});

		// The next request asks the same instance, so it sees the entry. This is the whole
		// point of a process-wide store: two browsers, one workspace.
		expect(getStore().readEntries("delivery")).toHaveLength(before + 1);
	});

	it("starts from the seed again when a second context is constructed", () => {
		const used = getStore();
		used.appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "This entry must not survive a reset.",
		});

		const fresh = createSeedStore();

		// A second context is a different store with the seed's content, not a view of the
		// first: this is what "a restart clears it" means, asserted without a process.
		expect(fresh).not.toBe(used);
		expect(fresh.readEntries("delivery").length).toBe(
			createSeedStore().readEntries("delivery").length,
		);
		expect(
			fresh
				.readEntries("delivery")
				.some(
					(entry) =>
						entry.kind === "message" && entry.text.includes("must not survive"),
				),
		).toBe(false);
	});

	it("resets the process's store to a fresh seed, in place", () => {
		getStore().appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "Reset me.",
		});

		const afterReset = resetStore();

		expect(afterReset.readEntries("delivery")).toHaveLength(
			createSeedStore().readEntries("delivery").length,
		);
		// And the reset store is the one `getStore` now hands out, so the next request sees it.
		expect(getStore()).toBe(afterReset);
	});

	it("exposes the reset hook only where a process says it is a test or a dev server", () => {
		// The rule, asserted as a pure function of the environment rather than by mutating
		// process.env: a production build refuses unless it explicitly declares a test mode.
		expect(resetAllowed({ NODE_ENV: "development" })).toBe(true);
		expect(resetAllowed({})).toBe(true);
		expect(resetAllowed({ NODE_ENV: "production" })).toBe(false);
		expect(
			resetAllowed({ NODE_ENV: "production", RELAYBOARD_TEST_MODE: "1" }),
		).toBe(true);
	});
});
