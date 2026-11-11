import { describe, expect, it } from "vitest";
import type { RelayboardClient } from "#/client";
import { clientOperations } from "#/client";
import { createHttpClient } from "#/client/http";
import { appendMessageInput } from "#/server/functions/inputs";

/**
 * The HTTP client's **boundaries**, asserted at the contract seam.
 *
 * ## What this file can assert, and what it cannot
 *
 * `createServerFn`'s client half performs a real RPC, and until the plugin's build-time transform has
 * run there is no RPC to perform. Under `vitest run` a created server function has exactly the keys
 * `["method", "__executeServer"]` — no `url`, no `serverFnMeta` — and calling one throws "No Start
 * context found in AsyncLocalStorage". Measured four ways (bare client, a probe vitest config with
 * `tanstackStart()`, a faked `window`, a patched `fetch`), all failing at the same line. So **no
 * assertion in this file answers an operation**; the answers are asserted over HTTP from a browser,
 * which is the path a client actually takes.
 *
 * What is assertable — and is the half a wrong implementation would get wrong — is the boundary:
 * which operations are served, which are absent and how loudly, that the payload shapes carry no
 * author, and that a schedule of refusals maps to the families the client branches on.
 *
 * ## The criterion this file cannot satisfy, stated plainly
 *
 * 06c:17 asks for 03's conformance suite to run unchanged against the HTTP client as part of
 * `npm test`. It does not, because the transport does not exist in that process. The suite runs
 * unchanged against the **in-memory** client in `tests/client.test.ts`, and the same contract is
 * asserted against the HTTP client in `e2e/writes.spec.ts` where the transport is real. That is a
 * substitution, and it is named here rather than left for a reader to discover.
 */
describe("the HTTP client", () => {
	const client: RelayboardClient = createHttpClient();

	it("sends the three acts to the server rather than refusing them locally", async () => {
		// **A change 06c makes, asserted because it changes what a caller sees.** Before this ticket
		// the three acts threw `NotYetImplementedError` in the browser, naming 10a. They are now real
		// POST server functions that refuse *server-side*, naming 10a — which is the honest shape:
		// the absence is the build's, not the browser's, and 10a replaces one handler rather than
		// deleting a client-side stub.
		//
		// Under Node the call cannot reach the server (see this file's header), so what is asserted
		// is precisely the thing that distinguishes the two shapes: the failure is the transport's
		// "no Start context", not the old local throw.
		for (const call of [
			() =>
				client.attachResource({ threadId: "delivery", resourceId: "res-1" }),
			() =>
				client.moveStatus({
					threadId: "delivery",
					from: "open",
					to: "resolved",
				}),
			() => client.acknowledge({ threadId: "delivery", upTo: 1 }),
		]) {
			const failure = await call().then(
				() => null,
				(error: unknown) => error,
			);
			expect(failure).toBeInstanceOf(Error);
			const message = (failure as Error).message;
			expect(
				message,
				`expected a transport failure (the act is on the wire), got: ${message}`,
			).toMatch(/No Start context|Server function/);
			expect(message).not.toMatch(
				/NotYetImplementedError|arrives with ticket 10a/,
			);
		}
	});

	it("subscribes to the route rather than throwing a ticket name", () => {
		// **This assertion used to require a throw, and that is what a placeholder costs.** Until 11a the
		// stream did not exist, so the honest behaviour was to fail loudly naming the ticket (06a rule).
		// 11a implements it, so the same call now returns a working unsubscribe - and the test changes
		// with it rather than being deleted, because "subscribe does not throw" is a claim that a
		// transport arrived.
		//
		// `import.meta.env.SSR` is true under `vitest run`, so the client returns a no-op with a stated
		// reason instead of opening an `EventSource` that does not exist in Node. The browser branch is
		// asserted at the route seam, where a real `EventSource` connects to a real server.
		const unsubscribe = client.subscribe({ onEvent: () => {} });
		expect(typeof unsubscribe).toBe("function");
		expect(() => unsubscribe()).not.toThrow();
	});

	it("declares every operation the interface declares, so none is silently missing", () => {
		// A client missing a member would not compile, but a client whose member is an inherited
		// no-op would. Each declared operation is present as a function.
		for (const operation of clientOperations) {
			expect(
				typeof client[operation],
				`${operation} is not a function on the HTTP client`,
			).toBe("function");
		}
	});

	it("carries no author field in any write payload the interface accepts", () => {
		// The interface's own input types are the first line: none names an author. This asserts that
		// the *boundary schema* agrees, because a schema with an author field would accept one even
		// when the type did not, and the type is erased at runtime.
		const parsed = appendMessageInput.parse({
			threadId: "delivery",
			text: "hi",
			// A forged author, exactly as a hand-written request would carry it.
			authorId: "orion",
		});
		expect(Object.keys(parsed).sort()).toEqual(["text", "threadId"]);
		expect(parsed).not.toHaveProperty("authorId");
	});

	it("strips a forged author rather than refusing it, so there is nothing to probe", () => {
		// Deliberate: a refusal would tell a caller whether the forged field was seen. The schema is a
		// `z.object` without `passthrough`, so unknown keys are dropped and the handler never sees
		// them. The author that reaches the store is always the resolved principal (06b).
		const parsed = appendMessageInput.parse({
			threadId: "delivery",
			text: "hi",
			authorId: "orion",
			idempotencyKey: "k",
		});
		expect(parsed).toEqual({
			threadId: "delivery",
			text: "hi",
			idempotencyKey: "k",
		});
	});
});
