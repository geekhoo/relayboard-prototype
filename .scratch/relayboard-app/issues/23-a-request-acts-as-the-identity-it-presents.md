# 23: A request acts as the identity its credentials name, and says so in one family

**What to build:** Three identity refusals that currently say the wrong thing. A request carrying both a session cookie and a bearer token acts as the cookie, exactly as the module documents, so a browser proxied through an agent gateway is never silently the agent. A session naming a principal the workspace no longer holds is refused as unauthenticated — the one case a client must not retry — rather than as a malformed request, including at the stream route, where it is currently an unhandled server error. And every admission refusal reaches the browser in the family that matches what happened: a gate refusal is a permission refusal of an identified caller, not "there is no session".

**Blocked by:** None (can start immediately). Ticket 22 changes the same admission error paths; take them in sequence rather than in parallel.

**Status:** ready-for-agent

**Found by:** security F3 at `src/server/principal.ts:154-155` against `:192-207`; security F11 at `src/server/principal.ts:213-214` into `src/client/http.ts:125-155`; security F7 at `src/server/functions/admission.ts:38-46`; the Lead's own probe, recorded in the synthesis, of an unhandled 500 on the stream route for a signed cookie naming a missing principal.

- [ ] **Unit/domain seam.** A request presenting both credentials resolves to the cookie's principal and its grants, and the bearer token is not consulted. The reverse case — cookie absent — still resolves as the agent. Both asserted in one case, because the current code passes the second by construction.
- [ ] **Unit/domain seam.** A bearer token that matches no issued record is still refused rather than ignored, so the precedence fix does not turn a deliberate credential into an anonymous request.
- [ ] **Unit/domain seam.** A valid signature naming a principal the store does not hold classifies as unauthenticated, and the message's own instruction ("ask for a new session") is the thing the classifier matches on. The assertion is the family, not the wording, so a reworded message that keeps the family passes.
- [ ] **Route seam.** A signed cookie naming a missing principal hitting the stream route returns the unauthenticated family rather than an unhandled server error; the response carries the refusal, not a 500. This is reachable with a hand-crafted cookie and must be provable without one being valid in any other sense.
- [ ] **Unit/domain seam.** Every admission refusal reason maps to a family: a gate refusal is `denied` and names the permission; an unknown request is unknown-object; a grant refusal escaping `admit` arrives with a code rather than bare. Asserted as a table over the reasons, so a new reason without a family fails.

**Leaves the build green:** yes.
