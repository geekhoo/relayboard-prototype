import "./StoreLifetimeNote.css";

/**
 * What this workspace is, said where a participant reads it.
 *
 * The app's store is in memory and one restart clears it. That is a real limitation of this
 * build rather than an implementation detail, and the product's own honesty rule ("never claim
 * a guarantee the implementation does not make") makes it something the interface says rather
 * than something a README mentions. Story 148 asks for exactly this sentence.
 *
 * It is deliberately quiet: an 11px label in muted ink, not a warning. It is a fact about the
 * workspace, not an error state, and 12's participant panel is where a fuller telling belongs.
 * The type size and the ink are tokens rather than arbitrary values, so when 13a measures the
 * product's text floors it is measuring something real.
 */
export function StoreLifetimeNote() {
	return (
		<p className="store-lifetime">
			This workspace is held in memory. A restart clears it, including
			everything you post.
		</p>
	);
}
