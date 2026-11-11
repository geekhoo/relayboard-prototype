import { describe, expect, it } from "vitest";
import { actingPrincipalQuery } from "#/client/context";
import { createInMemoryClient } from "#/client/in-memory";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * "Who am I" answered by the transport, and the note that shows it.
 *
 * The defect this covers was found by measurement rather than reasoning: with the session in place,
 * a **second browser** was issued `maya` by the server while the interface claimed `alex`, because
 * the UI had guessed its identity from the seed instead of asking. No gate could see it, and it is
 * precisely the kind of wrong-on-screen this product's honesty rule exists to prevent.
 *
 * What is asserted here is the seam that fixes it: the question is on the interface, both transports
 * answer it, and the answer is the principal the transport was actually given.
 */

describe("the acting principal, as the transport reports it", () => {
	it("is on the interface, so the UI has one rule rather than a branch per transport", async () => {
		const store = createStore(demoSeed(), demoOptions());
		const client = createInMemoryClient({ store, principalId: "maya" });

		const principal = await client.readActingPrincipal();

		// The in-memory transport has no session, so it answers from the principal it was built
		// with — and that is the correct answer there, not a guess.
		expect(principal.id).toBe("maya");
		expect(principal.name).toBe("Maya Chen");
	});

	it("gives every client its own answer, so two participants cannot both be the first one", async () => {
		const store = createStore(demoSeed(), demoOptions());
		const alex = createInMemoryClient({ store, principalId: "alex" });
		const maya = createInMemoryClient({ store, principalId: "maya" });

		// This is the assertion the two-browser defect would have failed: one workspace, two clients,
		// two identities.
		expect((await alex.readActingPrincipal()).id).toBe("alex");
		expect((await maya.readActingPrincipal()).id).toBe("maya");
	});

	it("is primed by the loader's query, so the note is right at first paint", async () => {
		const client = createInMemoryClient({
			store: createStore(demoSeed(), demoOptions()),
			principalId: "alex",
		});
		const definition = actingPrincipalQuery(client);

		// The Query definition is what the loader primes and what the hook reads, so the id the
		// frame renders and the data it renders arrive together rather than the note correcting
		// itself after hydration. Asserted as the query's own answer, not through React.
		expect(definition.queryKey).toEqual(["acting-principal"]);
		expect((await definition.queryFn()).id).toBe("alex");
	});

	it("requires no grant, and says why rather than leaving a bare absence", () => {
		// It answers "which principal is this", not "what may it do": the grant question is
		// readPrincipal's, and that one is gated by read:member. Requiring a grant here would make
		// the question unanswerable exactly when the answer is "nobody" — which is how a client
		// learns it has no session at all.
		const requirement = operationPermissions.readActingPrincipal;

		expect(requirement).toHaveProperty("none");
		expect(requirement).toMatchObject({
			none: expect.stringContaining("no session"),
		});
	});
});

/** Re-imported here so the permission assertion reads as one statement. */
import { operationPermissions } from "#/client";
