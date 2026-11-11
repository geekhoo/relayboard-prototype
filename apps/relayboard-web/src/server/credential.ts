/**
 * The admission credential: its hash, its derived fingerprint, and the clock it lives on.
 *
 * ## Derived, and why that word carries the ticket
 *
 * An agent declares a name and an operator. Neither is checked, and neither may ever be styled as
 * though it were. What **this workspace** can say for itself is: it issued a credential, it knows
 * which one, and the credential's bytes are what it derived a fingerprint from. So the fingerprint is
 * a value derived from a secret the workspace minted — which is what makes it worth styling as
 * verified, and what a declared string can never be (spec L393-405, DESIGN.md §260).
 *
 * Two properties follow, and both are asserted:
 *
 * - **Two credentials for one principal yield the same fingerprint.** The fingerprint identifies the
 *   *principal*, not the credential, so a renewal must preserve it — otherwise a renewed agent would
 *   look like a new one and its history would split (spec L598).
 * - **Two principals yield different ones.** A fingerprint that collided would make two agents
 *   indistinguishable, which is the whole point of having one.
 *
 * ## The clock is injected
 *
 * Expiry is a function of time, and a test that waits for a real deadline is a test that flakes and a
 * suite that takes minutes. Every expiry decision here reads `now()` from a value the caller supplies,
 * so a test advances a fake clock and asserts a refusal in a millisecond rather than sleeping.
 */
import {
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

/** What a clock must provide. Injected so expiry is testable without sleeping. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

/**
 * A high-entropy opaque token: 32 bytes of CSPRNG, base64url.
 *
 * ~256 bits, which is what "opaque and high-entropy" means for a bearer token: there is nothing to
 * guess because there is nothing structured in it. It is explicitly **not** a JWT (spec L408) — a
 * self-describing token would carry its own claims, and a claim is only as good as the signature that
 * could not be revoked.
 */
export const mintToken = (): string => randomBytes(32).toString("base64url");

/** A token's stored form. The token itself is never kept: a leaked store should leak no credentials. */
export const hashToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");

/**
 * Constant-time comparison of two hex digests.
 *
 * Length first only because `timingSafeEqual` throws on unequal buffers; the comparison itself does
 * not return early, so a careful attacker learns nothing from the timing.
 */
export const sameHash = (left: string, right: string): boolean => {
	const a = Buffer.from(left, "hex");
	const b = Buffer.from(right, "hex");
	return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The fingerprint this workspace derives for a principal.
 *
 * **HMAC over the principal id, keyed by the installation secret.** Three properties, each of which
 * the ticket names:
 *
 * - It is stable across credentials, so a renewal preserves it (the input is the id, never the
 *   token).
 * - It differs between principals, because the input does.
 * - It cannot be reproduced without the secret, so it is *derived* rather than *declared*: an agent
 *   cannot present a fingerprint it chose and have it match.
 *
 * 16 hex characters rather than 64: this is shown to people, and 64 bits of a keyed MAC is far beyond
 * what guessing could reach for a value that is also only reachable by being admitted.
 */
export const deriveFingerprint = (
	principalId: string,
	secret: string,
): string =>
	createHmac("sha256", secret)
		.update(`principal:${principalId}`)
		.digest("hex")
		.slice(0, 16);

/**
 * The issuer: who vouched for this principal.
 *
 * **Derived from the grant, not from the credential.** The issuer is the human who admitted the
 * agent — the principal the grant records as its granter — so it is read from the workspace's own
 * records rather than asserted by anybody. A knocker that supplies an `issuer` field is ignored for
 * the same reason a supplied `fingerprint` is: there is nothing a caller can assert that this
 * workspace would accept about its own act of issuing.
 */
export interface Derived {
	/** Who admitted this principal. Derived from the grant that admitted it. */
	readonly issuer: string;
	/** A keyed digest of the principal id. Stable across credentials, unique per principal. */
	readonly fingerprint: string;
}
