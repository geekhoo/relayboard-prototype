import { QueryClient } from "@tanstack/react-query";
import type { RelayboardClientBound } from "#/client/context";
import { bindClient } from "#/client/context";
import { createInMemoryClient } from "#/client/in-memory";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The router's context: one Query client and one data client, per router.
 *
 * Created here rather than at module scope because a module-scope client would be one
 * instance shared by every request the server ever serves — the shape a real backend
 * must not have, and the shape 06a's store singleton is deliberately *not*. A router is
 * a request on the server and a page in the browser, so this is the narrowest lifetime
 * the seam can have.
 *
 * The client is the in-memory implementation, because no server function exists yet (06a
 * and 06c). It is built over this router's own store, and it acts as `demoPrincipalId()` —
 * the first principal the seed marks browser-selectable, rather than a hard-coded name.
 * Issuing that from a session cookie is 06b's; when it lands, this file asks the cookie
 * instead of the seed and nothing above it changes.
 */
export interface RouterContext {
	readonly queryClient: QueryClient;
	readonly client: RelayboardClientBound;
	/** The principal this client acts as. Read, never assumed, by anything that needs to name it. */
	readonly principalId: string;
}

/**
 * Who a browser acts as until sessions exist.
 *
 * The seed marks its principals `browserSelectable` in a fixed order (02c), and spec L366
 * selects round-robin from that list. Round-robin needs a store that persists across
 * requests, which is 06a's singleton and 06b's session; until then the first selectable
 * principal is the honest answer to "who is reading this page", and it is *read from the
 * seed* so a change to the seed's mark moves it.
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

export function getContext(): RouterContext {
	const queryClient = new QueryClient();
	const principalId = demoPrincipalId();
	// Each router gets its own workspace. That is wasteful under SSR and correct: the
	// alternative is a module-scope store, which would make every browser share one
	// server's memory before 06a decides where that memory lives.
	const client = bindClient(
		createInMemoryClient({
			store: createStore(demoSeed(), demoOptions()),
			principalId,
		}),
		principalId,
	);

	return { queryClient, client, principalId };
}

/** Kept for the scaffold's own import graph; the document shell renders no provider of its own. */
export default function TanstackQueryProvider() {}
