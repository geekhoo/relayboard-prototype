import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import type { Principal } from "#/domain";
import {
	encodeSession,
	type Resolution,
	resolveSession,
	SESSION_COOKIE,
	UnresolvedSession,
} from "#/server/principal";

/**
 * The request-time resolver every operation calls.
 *
 * One call and every handler starts with it:
 *
 * ```
 * const actor = actingPrincipal();
 * ```
 *
 * It reads the session cookie, resolves it to a principal, and — when the request arrived
 * without a usable cookie — issues one and sets it on the response. Both the browser's cookie
 * and (from 08a) an agent's credential arrive here; the resolver already carries a cookie rather
 * than being written against one, so a second credential is a second branch in `resolveSession`
 * and no change anywhere else.
 *
 * ## Why this is not middleware
 *
 * It could be: `createStart` accepts `requestMiddleware`. It is a function call instead for two
 * reasons. A request middleware also runs for document requests, where issuing a session is a
 * side effect no operation asked for. And the resolver has to be reusable by a **server route** as
 * well as a server function — 11a's SSE route is not a routed document request and cannot depend
 * on a hook that only wraps those — and a plain call is reusable by both.
 *
 * ## Resolution happens once per request, and that is load-bearing
 *
 * A page load calls several server functions (the rail's boards and counts, the pane's threads,
 * the acting principal itself), and during SSR they are called *directly*, in one request. If each
 * of them resolved independently, one page load would advance the round-robin a dozen times and
 * issue a dozen cookies, and the second browser would not be the second participant — measured:
 * both browsers came back as the same principal before this memo existed. The cache below is keyed
 * by the request object, so a request resolves once and every operation in it agrees.
 */

/**
 * One resolution per request.
 *
 * A WeakMap rather than a module variable: the key is the request, so nothing survives the request
 * it belongs to, and a concurrent request cannot read another's answer. `getRequest()` throws
 * outside a request (a unit test calling this directly, for instance), in which case there is no
 * request to key on and the caller gets a fresh resolution — which is the honest behaviour for a
 * caller that is not serving one.
 */
const resolvedPerRequest = new WeakMap<Request, Resolution>();

/** The signed cookie value for a principal. One definition, used by the header and by `setCookie`. */
export const sessionCookieFor = (principalId: string): string =>
	encodeSession(principalId);

/**
 * Who is acting on this request, issuing a session if there is none.
 *
 * Refuses when the cookie is validly signed but names a principal this workspace no longer holds
 * (spec L373): a stale session must resolve to *nobody* rather than quietly becoming somebody
 * else.
 */
/**
 * The bearer token on this request, if it carries one.
 *
 * Read from `Authorization` rather than from a custom header, because a bearer token is what that
 * header is for and a server-to-server caller already knows how to send one. An empty or malformed
 * header is treated as **no** credential rather than as a bad one, so a request that merely carries
 * `Authorization: Basic …` from an intermediary still resolves its cookie.
 */
const bearerFrom = (request: Request | undefined): string | undefined => {
	const header = request?.headers.get("authorization") ?? "";
	const [scheme, token] = header.split(" ");
	return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
};

export const actingPrincipal = (): Principal => {
	const request = requestOrUndefined();
	const cached = request ? resolvedPerRequest.get(request) : undefined;
	if (cached) return cached.principal;

	// **Both credentials, in one call.** A browser presents the cookie; an admitted agent presents a
	// bearer token in `Authorization`. Neither the handler above this line nor any operation asks which
	// one arrived (spec L404, 08a:23) — the resolver returns a principal and a grant shape either way.
	const resolution = resolveSession(
		getCookie(SESSION_COOKIE),
		bearerFrom(getRequest()),
	);
	if (request) resolvedPerRequest.set(request, resolution);
	if (resolution.issued) {
		// The cookie is only ever set on a response. It is `HttpOnly` and `SameSite=Lax`, so no
		// client script can read it and no cross-site form can carry it; that is the whole of what
		// this session claims, and the interface says so.
		setCookie(SESSION_COOKIE, sessionCookieFor(resolution.principal.id), {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 30,
			secure: process.env.NODE_ENV === "production",
		});
	}
	return resolution.principal;
};

/** The current request, or `undefined` when there is none (a direct call outside a request). */
const requestOrUndefined = (): Request | undefined => {
	try {
		return getRequest();
	} catch {
		return undefined;
	}
};

export { UnresolvedSession };
