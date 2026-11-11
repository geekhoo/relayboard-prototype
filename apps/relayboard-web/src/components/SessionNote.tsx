import "./SessionNote.css";

/**
 * What a session is, in a participant's words.
 *
 * The app issues a signed cookie naming the principal a browser acts as, and that is
 * **identity, not authentication**: this workspace holds no password, no second factor and no
 * proof of personhood, so a cookie says "this browser was handed this participant", never "this
 * browser is that person". Saying so where a participant reads it is the product's own rule —
 * never claim a guarantee the implementation does not make — and it is story 150's requirement
 * stated at the one control that could otherwise imply more.
 *
 * It names the acting principal **by id**, which is a value this workspace derived from the
 * cookie it issued, and it does so without a read: the id already travels on the client. The
 * participant's name, kind and grant belong to 12's panel, which reads them properly through
 * `readPrincipal`.
 *
 * It sits beside the store-lifetime note for the same reason: both are limits of *this* build
 * that a reader would otherwise assume away.
 */
export function SessionNote({ principalId }: { readonly principalId: string }) {
	return (
		<p className="session-note">
			You are acting as{" "}
			<span className="session-note__principal">{principalId}</span>. A session
			identifies you to this workspace; it does not sign you in, and anyone
			holding this browser&apos;s cookie acts as you.
		</p>
	);
}
