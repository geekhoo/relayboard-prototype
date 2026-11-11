import { QueryClient } from "@tanstack/react-query";
import type { RelayboardClient } from "#/client";
import type { RelayboardClientBound } from "#/client/context";
import { bindClient } from "#/client/context";
import { createHttpClient } from "#/client/http";
import { createInMemoryClient } from "#/client/in-memory";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The router's context: one Query client and one data client, per router.
 *
 * Created here rather than at module scope because a module-scope client would be a single
 * instance shared by every request the server ever serves — the shape a real backend must not
 * have. A router is a request on the server and a page in the browser, so this is the
 * narrowest lifetime the seam can have.
 *
 * ## Which transport, and why the choice is explicit
 *
 * **The in-memory client is the default and the one the UI renders from**, because the
 * mutations are not served yet (06c) and a UI that could read but not post is not a screen.
 * The HTTP client is selectable — `VITE_RELAYBOARD_TRANSPORT=http` — so the transport switch
 * is one seam rather than a rewrite, and so the server functions are part of the build rather
 * than dead code that nothing imports: a server function nothing imports is not registered
 * and therefore not reachable, which would make 'each read is reachable' untrue.
 *
 * **The two transports do not share a store, and that is a fact about this ticket rather than
 * a bug in it.** The in-memory client reads a store built here, in the router; the HTTP client
 * reads the process's store through the server functions. Until the UI is switched (06c),
 * those are two different workspaces. Recording it here rather than discovering it at 06c.
 */
export interface RouterContext {
	readonly queryClient: QueryClient;
	readonly client: RelayboardClientBound;
	/**
	 * The principal this client acts as, **resolved by the transport**.
	 *
	 * A placeholder here and replaced by the route loader's answer before any component renders
	 * (see `actingPrincipalQuery`): the router context is created synchronously, and resolving a
	 * principal is a read. The loader is where the two meet, which is why the frame never has to
	 * guess.
	 */
	readonly principalId: string;
}

/**
 * Who a browser acts as until sessions exist.
 *
 * The seed marks its principals `browserSelectable` in a fixed order (02c), and spec L368
 * selects round-robin from that list. Round-robin needs a store that persists across
 * requests — this ticket's singleton — and the cookie that carries the choice is 06b's.
 * Until then the first selectable principal is the honest answer, read from the seed so a
 * change to the seed's mark moves it.
 */
const demoPrincipalId = (): string => {
	const first = demoSeed().principals.find(
		(principal) => principal.browserSelectable,
	);
	if (!first) {
		throw new Error(
			"The demo seed marks no browser-selectable principal: a session has nobody to name",
		);
	}
	return first.id;
};

/** Which implementation the UI renders from. In-memory unless a build says otherwise. */
const transport = (): "memory" | "http" =>
	import.meta.env.VITE_RELAYBOARD_TRANSPORT === "http" ? "http" : "memory";

export function getContext(): RouterContext {
	const queryClient = new QueryClient();
	// The provisional id: an in-memory client acts as the principal it is constructed with, so
	// that is the correct answer there without a read. Over HTTP it is replaced by the server's
	// answer before anything renders — the loader primes `actingPrincipalQuery` and re-binds.
	const principalId = demoPrincipalId();
	const implementation: RelayboardClient =
		transport() === "http"
			? createHttpClient()
			: createInMemoryClient({
					// Each router gets its own workspace. Wasteful under SSR and correct: the
					// alternative is a module-scope store, which is the shape 06a's singleton exists
					// to replace for the server's own reads.
					store: createStore(demoSeed(), demoOptions()),
					principalId,
				});

	return {
		queryClient,
		client: bindClient(implementation, principalId),
		principalId,
	};
}

/** Kept for the scaffold's import graph; the document shell renders no provider of its own. */
export default function TanstackQueryProvider() {}
