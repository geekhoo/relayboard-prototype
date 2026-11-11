import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { Principal, RelayboardClient } from "#/client";

/**
 * The app's one way to reach the data client, and its one way to learn who it acts as.
 *
 * A component asks this hook rather than importing the adapter or, worse, the store: the
 * client is created once per router and carried on the router context, so the hook is the only
 * place that knows where it comes from. That is also what makes the transport swappable —
 * 06c replaces the object on the context and nothing here changes.
 *
 * ## Why the principal comes from the transport and not from the seed
 *
 * **The transport is the only thing that knows who the caller is.** Over HTTP the server
 * resolved a principal from the session cookie it issued, and the cookie is HttpOnly: the
 * browser cannot read it, and guessing from the seed gets the second browser wrong. That was
 * measured, not reasoned about — browser 1 was issued alex and browser 2 maya, while a
 * seed-guess had both acting as alex, so the session note named the wrong participant in one
 * of two windows. In memory there is no session, so the client answers from the principal it
 * was constructed with.
 *
 * Putting the question on the interface (readActingPrincipal) is what keeps ONE rule in the UI
 * — ask the transport — rather than a branch per component on which transport is in use.
 */
export interface RelayboardClientBound extends RelayboardClient {
	/**
	 * The principal this client acts as, resolved by the transport rather than assumed.
	 */
	readonly actingPrincipalId: string;
}

interface ClientContext {
	readonly client: RelayboardClientBound;
	readonly principalId: string;
}

/**
 * The client, re-bound to the principal the transport actually resolved.
 *
 * ## Why this exists, and the defect it fixes
 *
 * The router context's client is created with a **provisional** id (the seed's first
 * browser-selectable principal), because a context is built synchronously and resolving a principal
 * is a read. Every query key that partitions by reader used that provisional id, so a second browser
 * — issued `maya` — cached its rows under `alex`. Measured: the session note said maya and the
 * composer's placeholder said alex, in the same window, from one page load.
 *
 * The fix is one shape rather than two: whoever needs "who am I" reads it **through
 * `readActingPrincipal`**, which the loader primes, and the client they then use carries that id.
 * Components ask `useActingClient()` and get a client whose `actingPrincipalId` is the resolved one,
 * so a query key and a rendered name cannot disagree.
 */
export const useActingClient = (): RelayboardClientBound => {
	const client = useRelayboardClient();
	const resolved = useQuery(actingPrincipalQuery(client));
	const principalId = resolved.data?.id ?? client.actingPrincipalId;
	// Re-bound only when the id actually differs, so an unchanged answer does not produce a new
	// object on every render (and therefore a new query key identity).
	return principalId === client.actingPrincipalId
		? client
		: bindClient(client, principalId);
};

/**
 * The client plus the principal it acts as, both from the router context.
 *
 * principalId is primed by the route's loader through readActingPrincipal, so by the time a
 * component renders the id and the data arrived together — the same rule the rail's counts
 * follow, for the same reason: a value that corrects itself after hydration is briefly wrong on
 * screen.
 */
export const useRelayboardClient = (): RelayboardClientBound => {
	const { client } = useRouteContext({ from: "__root__" }) as ClientContext;
	return client;
};

/**
 * The principal the current client acts as, as the transport resolved it.
 *
 * Read through the same Query definition the loader primes, so the answer is the server's and it
 * is there at first paint rather than correcting itself after hydration. The router context's
 * `principalId` is the fallback and only the fallback: the provisional value the client was
 * constructed with, correct for the in-memory transport and replaced here whenever a resolved
 * answer exists.
 */
export const useActingPrincipalId = (): string => {
	const { client, principalId } = useRouteContext({
		from: "__root__",
	}) as ClientContext;
	const resolved = useQuery(actingPrincipalQuery(client));
	return resolved.data?.id ?? principalId;
};

/**
 * The client bound to the principal it acts as.
 *
 * Here rather than in the in-memory module because it is a property of the *seam*: both
 * transports are bound the same way, from the principal each of them resolved.
 */
export const bindClient = (
	client: RelayboardClient,
	principalId: string,
): RelayboardClientBound =>
	Object.assign(Object.create(null) as RelayboardClientBound, client, {
		actingPrincipalId: principalId,
	});

/** The Query definition for who I am, so a loader can prime it like any other read. */
export const actingPrincipalQuery = (client: RelayboardClient) => ({
	queryKey: ["acting-principal"] as const,
	queryFn: () => client.readActingPrincipal(),
});

/**
 * The principal the transport resolves, for a caller that has a client but no hook.
 *
 * The loader uses this: it needs the id before React renders, to build the context the frame
 * reads. One function, so the loader and the hook ask the same question the same way, and a
 * future server route (11a) can too.
 */
export const resolveActingPrincipal = async (
	client: RelayboardClient,
): Promise<Principal> => await client.readActingPrincipal();
