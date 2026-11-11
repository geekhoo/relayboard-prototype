import { createStart } from "@tanstack/react-start";
// The secret assertion, imported for its side effect. `src/server/principal.ts` reads
// `SESSION_SECRET` at module scope and throws if it is absent or too short, so evaluating this
// entry either succeeds with a usable secret or fails loudly with the variable named. A
// side-effect import because there is nothing to call: the module's whole contribution here is
// that it is evaluated before anything can serve a request.
import "#/server/principal";

/**
 * The server's start entry: the module the server loads before it handles a request, and the
 * only place a once-per-process requirement can be stated without trusting a request to arrive.
 *
 * ## Why this file exists
 *
 * `src/env.ts` shipped from the scaffold and was **imported by nothing**, so no variable was
 * validated at runtime. The session secret is the first thing in this repository with a real
 * value, and a missing one must fail loudly rather than surface as an unreadable cookie.
 * Importing the resolver above is what makes that validation run.
 *
 * ## What was measured, because the difference matters
 *
 * This entry is resolved by the plugin (`resolveEntry`, `defaultEntry: "start"`) and the built
 * chunk is imported — but it is imported **lazily, on the first request**, not when the process
 * starts. Measured rather than assumed: a start entry that throws at module scope leaves the
 * process listening and fails the first request with the error on stderr, instead of exiting at
 * boot. So the honest claim this file makes is "the server serves nothing without a secret, and
 * its first failure names the variable" — not "the process refuses to start".
 *
 * A true unbootable process is asserted by `scripts/check-boot.mjs`, which imports this entry's
 * built chunk in a fresh process, where the throw is fatal. The two assertions are deliberately
 * separate: this file's comment says which one it is, and that script says which one it is.
 *
 * `startInstance` is the entry's expected export. The app needs no custom start options yet, so
 * it is the default instance.
 */
export const startInstance = createStart(() => ({}));
