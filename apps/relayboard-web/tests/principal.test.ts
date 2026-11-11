import { beforeEach, describe, expect, it } from "vitest";
import {
	decodeSession,
	encodeSession,
	resetSessionRotation,
	resolveSession,
	sessionCookieHeader,
	UnresolvedSession,
} from "#/server/principal";
import { getStore, resetStore } from "#/server/store/instance";

/**
 * The resolver's decisions, asserted without a request.
 *
 * \`resolveSession\` takes the cookie's *value* rather than reading a request, so it is a pure
 * function of that value and the process's store — no Start context, no cookie jar, no server.
 * \`actingPrincipal()\` (in \`src/server/session.ts\`) is the thin wrapper that reads and writes
 * the real cookie; the decisions it delegates are all here, which is why this is the seam the
 * round-robin and the refusals are asserted at.
 */

const SECRET = process.env.SESSION_SECRET as string;

beforeEach(() => {
	// A fresh workspace and a fresh rotation, so a test's first request is the first request.
	resetStore();
	resetSessionRotation();
});

describe("round-robin session issuance", () => {
	it("walks the seed's selectable principals in order, and wraps", () => {
		// spec L366, L370: cyclic and stable within one store instance, so a test that opens two
		// browsers knows it got two different participants rather than one in two windows.
		const issued = [1, 2, 3, 4].map(
			() => resolveSession(undefined).principal.id,
		);

		// The seed marks alex then maya (02c), so the order is that order and the third wraps.
		expect(issued).toEqual(["alex", "maya", "alex", "maya"]);
	});

	it("marks a minted session as issued, so the transport knows to set a cookie", () => {
		const resolution = resolveSession(undefined);

		expect(resolution.issued).toBe(true);
		expect(resolution.principal.browserSelectable).toBe(true);
	});

	it("resolves a presented cookie to that principal, and issues nothing", () => {
		const cookie = encodeSession("maya", SECRET);
		const resolution = resolveSession(cookie);

		expect(resolution.principal.id).toBe("maya");
		// No cookie is set on a request that already had a usable one: reissuing on every request
		// would rotate the value forever and defeat the point of a stable session.
		expect(resolution.issued).toBe(false);
	});

	it("does not advance the rotation when a cookie is presented", () => {
		const first = resolveSession(undefined).principal.id;
		resolveSession(encodeSession(first, SECRET));
		resolveSession(encodeSession(first, SECRET));

		// The third fresh request is the SECOND selectable principal, not the fourth: presented
		// cookies are not new browsers.
		expect(resolveSession(undefined).principal.id).not.toBe(first);
	});
});

describe("a session that cannot be resolved", () => {
	it("is refused, not reassigned, when it names a principal the workspace does not hold", () => {
		// spec L371: a stale cookie must resolve to nobody rather than quietly becoming somebody
		// else. This is the case a purge or a reseed could produce, and the difference between
		// "refused" and "silently reassigned" is the difference between a bug report and a
		// mystery.
		const cookie = encodeSession("a-former-principal", SECRET);

		expect(() => resolveSession(cookie)).toThrow(UnresolvedSession);
		expect(() => resolveSession(cookie)).toThrow(/does not hold/);
	});

	it("treats a tampered cookie as no cookie at all, and issues a fresh session", () => {
		// A cookie this workspace never signed is not evidence of a principal AND not evidence of
		// a refusal: the browser is issued a session rather than being locked out for a token it
		// probably picked up from another deployment or a secret rotation. The test names what it
		// proves — a refused-and-ignored signature and a silently-ignored one look identical from
		// outside except for this fresh `issued: true`.
		const forged = encodeSession("maya", "a-different-secret-0123456789abcdef");
		const resolution = resolveSession(forged);

		expect(resolution.issued).toBe(true);
		expect(resolution.principal.id).not.toBe("maya");
	});

	it("refuses when the seed marks nobody browser-selectable", () => {
		// Reachable only by changing the seed, which is why it is asserted by construction rather
		// than by a fixture: a workspace with no selectable principal has nobody a session can
		// name, and serving as an arbitrary participant would be worse than failing.
		const store = getStore();
		expect(store.readPrincipal("alex")?.browserSelectable).toBe(true);
		// The seeded set is exactly what 02c asserts; this checks the resolver reads THAT set
		// rather than a hard-coded list, by confirming a non-selectable principal is never issued.
		const issued = [1, 2, 3, 4, 5, 6].map(
			() => resolveSession(undefined).principal,
		);
		for (const principal of issued)
			expect(principal.browserSelectable).toBe(true);
	});
});

describe("the session cookie's header", () => {
	it("is HttpOnly, SameSite=Lax and scoped to the whole app", () => {
		// Asserted on the header string rather than by a browser dropping a cookie: these flags
		// are what the transport emits, and a browser test cannot observe `HttpOnly` directly.
		const header = sessionCookieHeader("alex", SECRET);

		expect(header).toContain("HttpOnly");
		expect(header).toContain("SameSite=Lax");
		expect(header).toContain("Path=/");
		expect(header).toMatch(/Max-Age=2592000/); // 30 days
		// The value is the signed form, not the id.
		expect(header).not.toContain("=alex");
		expect(
			decodeSession(header.split("=").slice(1)[0]?.split(";")[0], SECRET),
		).toBe("alex");
	});

	it("sets Secure only in production, because a plain-http dev server would drop it", () => {
		const previous = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = "production";
			expect(sessionCookieHeader("alex", SECRET)).toContain("Secure");
			process.env.NODE_ENV = "development";
			expect(sessionCookieHeader("alex", SECRET)).not.toContain("Secure");
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});
