import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { requireSessionSecret } from "#/server/env";
import { decodeSession, encodeSession } from "#/server/principal";

/**
 * The session's signing and its boot requirement, asserted at the pure seam.
 *
 * Everything here is a pure function of a string and a secret, so it runs in Node with no
 * request, no cookie jar and no Start context. What it cannot prove is that the *process*
 * refuses to serve without a secret — that needs a process, and `scripts/check-boot.mjs`
 * does it after a build. The two assertions are deliberately separate and neither claims the
 * other: this file proves the module throws, that script proves the server serves nothing.
 */

const SECRET = "0123456789abcdef0123456789abcdef";
const OTHER_SECRET = "fedcba9876543210fedcba9876543210";

describe("the session secret", () => {
	it("is required, and its absence names the variable", () => {
		// The message is the whole value of the check: an operator reading a crash needs to know
		// which variable to set and why.
		for (const source of [
			{},
			{ SESSION_SECRET: "" },
			{ SESSION_SECRET: "   " },
		]) {
			expect(() => requireSessionSecret(source)).toThrow(/SESSION_SECRET/);
			expect(() => requireSessionSecret(source)).toThrow(/required/);
		}
	});

	it("is refused when it is too short to be a signing key", () => {
		expect(() => requireSessionSecret({ SESSION_SECRET: "hunter2" })).toThrow(
			/too short/,
		);
		// The floor is 32 characters, which is where a base64 secret from `openssl rand` sits.
		expect(() =>
			requireSessionSecret({ SESSION_SECRET: "x".repeat(31) }),
		).toThrow(/too short/);
		expect(requireSessionSecret({ SESSION_SECRET: "x".repeat(32) })).toBe(
			"x".repeat(32),
		);
	});

	it("cannot be satisfied by a variable the process does not have", () => {
		// The scaffold's failure mode, kept as a regression: `import.meta.env` alone cannot see
		// a server-only variable, so a resolver reading only that would always throw. The
		// composed environment is what makes this pass, and the test names the mechanism.
		const processLike = { SESSION_SECRET: SECRET };
		expect(requireSessionSecret(processLike)).toBe(SECRET);
		expect(() =>
			requireSessionSecret({ VITE_APP_TITLE: "Relayboard" }),
		).toThrow(/SESSION_SECRET/);
	});
});

describe("the session cookie's value", () => {
	it("round-trips the principal it was signed for", () => {
		const cookie = encodeSession("alex", SECRET);

		expect(decodeSession(cookie, SECRET)).toBe("alex");
		// The value is opaque: an id in plain text would let a reader edit the cookie by hand and
		// expect it to work, which is the illusion a signature exists to break.
		expect(cookie).not.toContain("alex");
	});

	it("is refused when the signature does not match the id", () => {
		// The forged-cookie case: take a valid cookie and swap the id, keeping the signature.
		const [encodedAlex, signature] = encodeSession("alex", SECRET).split(".");
		const encodedMaya = Buffer.from("maya", "utf8").toString("base64url");

		expect(decodeSession(`${encodedMaya}.${signature}`, SECRET)).toBeNull();
		expect(encodedAlex).toBeDefined();
	});

	it("is refused when it was signed with a different secret", () => {
		// A cookie from another deployment, or one signed before a secret rotation.
		expect(
			decodeSession(encodeSession("alex", OTHER_SECRET), SECRET),
		).toBeNull();
	});

	it("is refused when it is malformed, rather than throwing", () => {
		for (const value of [
			"",
			"alex",
			"alex.",
			".sig",
			"a.b.c",
			"!!!.???",
			undefined,
		]) {
			expect(decodeSession(value, SECRET)).toBeNull();
		}
	});

	it("is bound to the exact secret, not to a prefix of it", () => {
		// A signature over a truncated secret would accept every cookie the longer one signs.
		expect(
			decodeSession(encodeSession("alex", SECRET), SECRET.slice(0, 16)),
		).toBeNull();
		expect(
			decodeSession(encodeSession("alex", SECRET.slice(0, 16)), SECRET),
		).toBeNull();
	});

	it("is deterministic, so the same principal and secret sign the same bytes", () => {
		// Not a security property, but it is what makes a cookie survive a page reload rather
		// than being reissued on every request.
		expect(encodeSession("maya", SECRET)).toBe(encodeSession("maya", SECRET));
		expect(encodeSession("maya", SECRET)).not.toBe(
			encodeSession("alex", SECRET),
		);
	});

	it("uses HMAC-SHA256 over the principal id, which is what the resolver documents", () => {
		// Asserted against an independently computed signature rather than against the encoder:
		// a test that recomputed with the module's own helper would agree with a wrong algorithm.
		const expected = createHmac("sha256", SECRET)
			.update("alex")
			.digest("base64url");
		expect(encodeSession("alex", SECRET)).toBe(
			`${Buffer.from("alex", "utf8").toString("base64url")}.${expected}`,
		);
	});
});
