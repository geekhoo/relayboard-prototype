import { createHmac, timingSafeEqual } from "node:crypto";
import type { Principal } from "#/domain";
import { requireSessionSecret } from "#/server/env";
import { getStore } from "#/server/store/instance";

/**
 * Who is acting, resolved once per request.
 *
 * This is the **one seam every operation goes through**, and it is deliberately not written
 * against cookies alone: the browser presents a session cookie and an agent will present a
 * credential (08a), and both arrive here as an opaque token that resolves to a principal. The
 * enforcement path never asks which kind the principal is (spec L406).
 *
 * ## Why the secret is required at import time
 *
 * The secret is read at module scope, so importing this module without one throws. That is
 * what makes a missing `SESSION_SECRET` a **startup** failure rather than a first-request
 * one (story 151): every path that can resolve a principal loads this module, and every path
 * that serves a request resolves a principal.
 *
 * ## What this is not
 *
 * **A session identifies; it does not authenticate.** The cookie asserts "this browser was
 * handed this principal id", not "this browser is that person". The workspace holds no
 * password, no second factor and no proof of personhood, and the interface says so where a
 * participant reads it (see `SessionNote`). Any stronger claim would be false.
 */

/**
 * Read and validated at import **on the server**: absent or too short is a startup failure naming
 * the variable.
 *
 * ## Why the guard is `import.meta.env.SSR`, which is not a weakening of it
 *
 * The first version read the secret unconditionally at module scope, and that shipped the throw
 * into the **client** bundle: `src/client/http.ts` imports the server functions, those import this
 * module, and a bundler keeps a module's top-level statements even when it strips the server
 * function bodies. The result was measured in a served build — the client entry threw on load, so
 * React never hydrated and every control on the page was inert: the search box accepted text into
 * the DOM and wrote nothing to the URL, and the unread filter did nothing at all. A startup guard
 * that disables the whole application is not a guard.
 *
 * The condition is a build-time constant, so the server bundle contains the call and the client
 * bundle does not: `scripts/check-boot.mjs` still proves the built entry refuses to load without a
 * secret, and the client — which can serve no request and has no environment to validate — carries
 * no secret at all. What the guard promises is unchanged: a server without a secret serves nothing.
 */
const SECRET = import.meta.env.SSR ? requireSessionSecret() : "";

/** The cookie's name. Namespaced so it cannot collide with anything else on the origin. */
export const SESSION_COOKIE = "relayboard_session";

/** How long a session lasts. Long, because a returning reader is the product's whole premise. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** One principal's session, as the cookie carries it. */
export interface ResolvedPrincipal {
	readonly principal: Principal;
	/** What it may do. Membership until 07a's grants; the shape is what matters here. */
	readonly permissions: readonly string[];
}

/** The session could not be resolved: there is no principal to act as. */
export class UnresolvedSession extends Error {
	constructor(detail: string) {
		super(detail);
		this.name = "UnresolvedSession";
	}
}

/** `<principalId>.<hmac>`, base64url on both sides so a cookie holds no reserved characters. */
const sign = (principalId: string, secret: string): string =>
	createHmac("sha256", secret).update(principalId).digest("base64url");

export const encodeSession = (principalId: string, secret = SECRET): string =>
	`${Buffer.from(principalId, "utf8").toString("base64url")}.${sign(principalId, secret)}`;

/**
 * The principal id a cookie asserts, or `null` if the cookie is missing, malformed or forged.
 *
 * Constant-time comparison, because a signature check that returns early on the first
 * differing byte is a check a careful attacker can measure. The length is compared first only
 * because `timingSafeEqual` throws on unequal buffers.
 */
export const decodeSession = (
	value: string | undefined,
	secret = SECRET,
): string | null => {
	if (!value) return null;
	const [encodedId, signature] = value.split(".");
	if (!encodedId || !signature) return null;
	let principalId: string;
	try {
		principalId = Buffer.from(encodedId, "base64url").toString("utf8");
	} catch {
		return null;
	}
	const expected = sign(principalId, secret);
	const given = Buffer.from(signature, "utf8");
	const wanted = Buffer.from(expected, "utf8");
	if (given.length !== wanted.length) return null;
	return timingSafeEqual(given, wanted) ? principalId : null;
};

/**
 * The principals a browser may be issued, in the seed's order.
 *
 * Read from the store rather than hard-coded, so a change to the seed's `browserSelectable`
 * marks moves this without a second edit — and so there is one list rather than two that can
 * disagree.
 */
const selectablePrincipalIds = (): readonly string[] =>
	getStore()
		.listBoards()
		.flatMap((board) => getStore().listMembers(board.id))
		.flatMap((member) => [member.id])
		.filter(
			(id, index, all) =>
				all.indexOf(id) === index &&
				getStore().readPrincipal(id)?.browserSelectable === true,
		);

/**
 * The principal a request acts as, issuing one when the request has none.
 *
 * Round-robin over the seed's selectable principals, **cyclic and stable within one store
 * instance** (spec L372): a counter on the process, so the first browser is one principal, the
 * second another, and the third wraps. A test that opens two browsers therefore knows it has
 * two different participants rather than one participant in two windows — which is what makes
 * "two participants, one workspace" a claim the app can check.
 *
 * A cookie naming a principal the workspace no longer holds resolves to **nothing** and is
 * refused rather than silently reassigned (spec L373), so a stale cookie cannot quietly become
 * somebody else.
 */
const rotation = { next: 0 };

export interface Resolution {
	readonly principal: Principal;
	/** True when this resolution minted a session that must be set on the response. */
	readonly issued: boolean;
}

export const resolveSession = (cookieValue: string | undefined): Resolution => {
	if (cookieValue !== undefined) {
		const principalId = decodeSession(cookieValue);
		if (principalId !== null) {
			const principal = getStore().readPrincipal(principalId);
			if (!principal) {
				throw new UnresolvedSession(
					`This session names principal "${principalId}", which this workspace does not hold. It may have been removed by a purge or a reseed; ask for a new session rather than retrying this request.`,
				);
			}
			return { principal, issued: false };
		}
		// A cookie that fails its signature is treated as no cookie at all: the browser is
		// issued a fresh session rather than being refused for a token this workspace never
		// signed. A *valid* signature naming a missing principal is the case above, and that
		// one is refused.
	}

	const selectable = selectablePrincipalIds();
	if (selectable.length === 0) {
		throw new UnresolvedSession(
			"The demo seed marks no browser-selectable principal, so there is nobody for a session to name.",
		);
	}
	const principalId = selectable[rotation.next % selectable.length] as string;
	rotation.next += 1;
	const principal = getStore().readPrincipal(principalId);
	if (!principal) {
		throw new UnresolvedSession(
			`The seed's selectable principal "${principalId}" is not in this workspace.`,
		);
	}
	return { principal, issued: true };
};

/** The `Set-Cookie` value for a freshly issued session. */
export const sessionCookieHeader = (
	principalId: string,
	secret = SECRET,
): string =>
	[
		`${SESSION_COOKIE}=${encodeSession(principalId, secret)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${SESSION_MAX_AGE_SECONDS}`,
		// Secure only outside development: a plain-http dev server would drop a Secure cookie
		// and the reader would be issued a new session on every request.
		process.env.NODE_ENV === "production" ? "Secure" : "",
	]
		.filter(Boolean)
		.join("; ");

/** Resets the rotation. Test and dev only, so a harness gets a predictable first session. */
export const resetSessionRotation = (): void => {
	rotation.next = 0;
};
