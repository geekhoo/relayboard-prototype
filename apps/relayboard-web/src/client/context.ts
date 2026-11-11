import { useRouteContext } from "@tanstack/react-router";
import type { RelayboardClient } from "#/client";

/**
 * The app's one way to reach the data client.
 *
 * A component asks this hook rather than importing `src/client/in-memory` or, worse, the
 * store: the client is created once per router and carried on the router context, so the
 * hook is the only place that knows where it comes from. That is also what makes the
 * transport swappable — 06a replaces the object on the context and nothing here changes.
 */
export interface RelayboardClientBound extends RelayboardClient {
	/**
	 * The principal this client acts as.
	 *
	 * Named beside the operations rather than as one because it is not an operation: it is a
	 * fact about the caller, resolved by the transport, that the UI reads and never sets. It
	 * is here so that a component can mark its own entries, key a cache per reader, and show
	 * the reader who they are — three things that would otherwise each reach for a second
	 * source of truth.
	 */
	readonly actingPrincipalId: string;
}

interface ClientContext {
	readonly client: RelayboardClientBound;
	readonly principalId: string;
}

/** The client plus the principal it acts as, both read from the router context. */
export const useRelayboardClient = (): RelayboardClientBound => {
	const { client } = useRouteContext({ from: "__root__" }) as ClientContext;
	return client;
};

/** The principal the current client acts as. */
export const useActingPrincipalId = (): string => {
	const { principalId } = useRouteContext({
		from: "__root__",
	}) as ClientContext;
	return principalId;
};

/**
 * Binds a client to the principal it acts as.
 *
 * Kept here rather than in the in-memory module because it is a property of the *seam*, not
 * of one transport: 06a's HTTP client is bound the same way, from the resolved session.
 */
export const bindClient = (
	client: RelayboardClient,
	principalId: string,
): RelayboardClientBound =>
	Object.assign(Object.create(null) as RelayboardClientBound, client, {
		actingPrincipalId: principalId,
	});
