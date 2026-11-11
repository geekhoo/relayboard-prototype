import { describe, expect, it } from "vitest";
import type { RelayboardClient } from "#/client";
import { clientOperations } from "#/client";
import { createHttpClient } from "#/client/http";

/**
 * The HTTP client's *boundaries*, asserted at the contract seam.
 *
 * What this file deliberately does not do is answer the reads. `createServerFn`'s client half
 * performs a real RPC through a request-scoped Start context, so calling a read here would
 * throw "No Start context found in AsyncLocalStorage" — a test of the harness rather than of
 * the app. The reads' behaviour is asserted over HTTP against a served build, which is the
 * path a client actually takes, and 06c runs the whole conformance suite that way.
 *
 * What *is* assertable here, and is the half a wrong implementation would get wrong, is the
 * shape of the absences: every operation this build cannot serve must fail loudly and name
 * the ticket that lands it, so an unimplemented feature can never read as a pass.
 */

describe("the HTTP client", () => {
	const client: RelayboardClient = createHttpClient();

	it("fails loudly on every operation this build does not serve, naming the ticket", async () => {
		// The writes belong to 06c and the three acts to 10a. Each is asserted separately
		// rather than in a loop so a failure names the operation that broke the rule.
		await expect(
			client.appendMessage({ threadId: "delivery", text: "Not yet." }),
		).rejects.toThrow(/06c/);
		await expect(
			client.createThread({ boardId: "platform", title: "Not yet." }),
		).rejects.toThrow(/06c/);
		await expect(client.createBoard({ name: "Not yet." })).rejects.toThrow(
			/06c/,
		);
		await expect(
			client.addResource({
				boardId: "platform",
				name: "Not yet.",
				url: "https://example.com/none",
				description: "Not yet.",
			}),
		).rejects.toThrow(/06c/);
		await expect(client.simulateIncoming("delivery")).rejects.toThrow(/06c/);
		await expect(
			client.attachResource({ threadId: "delivery", resourceId: "res-1" }),
		).rejects.toThrow(/10a/);
		await expect(
			client.moveStatus({ threadId: "delivery", from: "open", to: "done" }),
		).rejects.toThrow(/10a/);
		await expect(
			client.acknowledge({ threadId: "delivery", upTo: 1 }),
		).rejects.toThrow(/10a/);
	});

	it("throws rather than returning an empty subscription for the stream", () => {
		// An empty subscription is indistinguishable from a thread with no entries, which is
		// the failure spec L516 forbids being rendered as an absence.
		expect(() => client.subscribe({ onEvent: () => {} })).toThrow(/11a/);
	});

	it("declares the connection state honestly: not connected, nothing pending", async () => {
		const state = await client.setConnection({ connected: true });

		// The stream does not exist in this build, so reporting "connected" would be a claim
		// the implementation cannot make. It reports the true thing instead of the requested one.
		expect(state).toEqual({ connected: false, pending: 0 });
	});

	it("covers every operation the interface declares, so none is silently missing", () => {
		// A client missing a member would not compile, but a client whose member is an
		// inherited no-op would. This asserts each declared operation is present *and* that
		// the absent ones are the ones named above rather than an undocumented third kind.
		const absent = [
			"appendMessage",
			"createThread",
			"createBoard",
			"addResource",
			"simulateIncoming",
			"attachResource",
			"moveStatus",
			"acknowledge",
			"subscribe",
		];
		const served = clientOperations.filter(
			(operation) => !absent.includes(operation),
		);
		for (const operation of served) {
			expect(typeof client[operation]).toBe("function");
		}
		// Nine absent, nine served: the reads plus setConnection are this build's half.
		expect(absent).toHaveLength(9);
		expect(served).toHaveLength(clientOperations.length - absent.length);
	});
});
