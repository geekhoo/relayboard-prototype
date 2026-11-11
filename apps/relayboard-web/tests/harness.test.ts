import { describe, expect, it } from "vitest";

/**
 * The harness asserted at its own seam: a Vitest run in Node, with no DOM
 * implementation installed and no test API leaked into the global scope.
 *
 * Both facts are asserted rather than assumed, because a later change could take
 * either away silently — a `test.environment` switched to `jsdom`, or
 * `test.globals: true` added to stop every file importing `describe`/`it`/`expect` —
 * and both are cheap to check from inside a test.
 *
 * The other half of the ticket's "no browser, no DOM, no network" is not
 * assertable from inside the suite without doing the thing it forbids: proving
 * that no test reads a file, spawns a process or opens a socket would itself have
 * to read a file or import `node:fs`. It is kept true by construction instead —
 * every file under `tests/` imports `vitest` and `#/domain` and nothing else, so a
 * test that gained an I/O dependency would be visible in its import list.
 */
describe("the test harness", () => {
	it("runs in Node with no DOM implementation installed", () => {
		expect(process.versions.node).toBeTypeOf("string");
		// The globals a DOM implementation defines. Neither jsdom nor happy-dom is a
		// dependency, and the run must not acquire one: if either arrives, these stop
		// being undefined and this test fails rather than the suite quietly passing in
		// a simulated browser.
		expect(globalThis.document).toBeUndefined();
		expect(globalThis.window).toBeUndefined();
		expect(globalThis.HTMLElement).toBeUndefined();
		// `localStorage` is deliberately not asserted here: Node 26 defines its own
		// behind a flag, so its presence would say nothing about a DOM implementation.
		// `document` is the unambiguous one.
	});

	it("exposes no test API as a global, so every file imports describe/it/expect", () => {
		// This is the inverse of `test.globals`: with globals enabled, the runner puts
		// these on globalThis and a file could rely on them without importing. Their
		// absence is what makes the import in each file load-bearing.
		//
		// Read through an untyped view of the global object on purpose: `globalThis`
		// has no index signature, and asking it for `describe` only compiles when the
		// ambient test globals are declared — which is exactly the configuration this
		// test exists to keep off.
		const globals = globalThis as unknown as Record<string, unknown>;
		for (const name of ["describe", "it", "expect", "beforeEach"]) {
			expect(
				globals[name],
				`${name} leaked into the global scope`,
			).toBeUndefined();
		}
	});
});
