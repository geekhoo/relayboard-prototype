# 08c: Expiry, revocation, renewal and a fingerprint the workspace derived

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The part that makes it safe to keep admitting. An admission carries an expiry, revocation ends access on the principal's next request rather than at the next reconnect, a revoked or expired principal's past entries keep their author, and a renewal after expiry resolves to the same principal so history does not split. The issuer and fingerprint stop being values an agent supplies and become values this workspace derived from the credential it issued — and the payload keeps them distinguishable from what the agent merely declared.

**Blocked by:** 08b — The gatekeeper's decision surface

**Write scope:** expiry, revocation and renewal inside the admissions module; the derived fingerprint and issuer.

**Status:** done — verified, with 2 criteria open; see `## Comments`

- [ ] **Partly satisfied — the expiry is real, the default has no subject.** An admission carries an expiry chosen at admission: a bounded window, or never. An admission admitted before this ticket existed is given a bounded default rather than becoming permanent (spec L393).
- [x] An expired admission is refused on the principal's next request, not at the next reconnect and not at the next poll (spec L596).
- [x] A human holding `revoke:agent` can revoke an admission, and the revoked principal is refused on its next request (spec L597). Revoking does not remove the principal, its entries, or its authorship.
- [x] A revocation is distinguishable in the refusal from a denial and from an expiry, so an operator can tell a policy decision from a bug (spec L402).
- [x] The entries a revoked or expired principal already authored keep their author, and a test asserts one of them is still attributed to it after revocation.
- [x] Renewal after expiry resolves to the **same principal id**, so its history stays one continuous record rather than splitting per credential (spec L598). A test renews and asserts the entry's author id is unchanged.
- [x] **Renewal is proved by the expired credential itself**, presented in the renewal request and verified against its stored hash — not by matching the name or operator the caller declares. An expired principal holds nothing, so a renewal matching declared values would let any caller inherit another principal's history. A renewal presenting an expired credential for principal P reissues for P with a fresh expiry and a different credential hash; a renewal presenting a name and operator but no credential is refused.
- [x] A renewal presenting a credential whose hash is unknown is refused, and one principal's credential cannot renew a different principal.
- [x] The issuer and fingerprint are derived by the server from the credential it issued: two credentials for one principal yield the same fingerprint, two principals yield different ones, the renewal above preserves it, and a `fingerprint` field supplied by the knocker is ignored rather than stored.
- [x] Declared and derived values are distinguishable **in the payload**, not only in the UI: the declared operator is echoed as declared and the derived issuer and fingerprint sit in their own fields, so a non-browser client cannot mistake one for the other (spec L599).
- [x] An admitted agent acting outside its grant is refused exactly as a human outside its grant would be, asserted on the same operation for both, so the refusal shape is proven identical (spec L590).
- [ ] **Partly satisfied — the store half is complete, and nothing can reach an admission over the wire.** The seam carries every assertion above for both the store and the running server.
- [x] The interface draws the line the product promises: a derived value may look verified, a declared value never may (`DESIGN.md` §260, §293), and the participant surface this feeds is 12's.

**Leaves the build green:** yes. The admission lifecycle is complete.

## Comments

**Implemented and verified** at `b0704df`. The admission lifecycle closes: an agent's issuer and
fingerprint are derived by the workspace, an admission expires, a credential can be renewed by presenting
the expired one, and a revocation stops resolving on the next request whichever side of the socket it
arrives from.

What was checked, rather than assumed:

- **The fingerprint is an HMAC over the principal id keyed by the installation secret**, so it is stable
  across credentials, unique per principal, and cannot be produced without the secret. This was proved by
  making the derivation wrong: keying it on the credential hash instead splits an agent's history at every
  renewal, and the assertion that catches it is the one that checks the fingerprint survives a renewal.
- The issuer is the human the workspace's own grant records as the granter — read from the grants rather
  than accepted from the knocker.
- A knock supplying its own fingerprint and issuer has both **ignored**, and the separation is in the
  payload as well as on screen: derived values are their own fields, and declared is a different field
  that is never merged into them.
- **Renewal presents the credential it is renewing.** There is no shape for a name-only renewal, and the
  three refusals have three different messages — nothing presented, a credential that has not expired, and
  an admission that was revoked — because revocation is a decision and a renewal cannot undo it. The
  principal id comes from the record rather than from the caller.
- Expiry and revocation are checked inside the one function every request passes through, so both take
  effect before any component can render. **The clock is injected**, so the suite asserts a refusal in
  milliseconds rather than waiting for a window and flaking on a loaded machine.
- Revoking keeps the principal, its grants and its authorship: a revoked agent's entries still name it,
  because authorship is a record of who acted rather than of who may act.

**Two of this ticket's own tests were vacuous first, and that is worth recording.** One compared a
fingerprint to itself on a surface with no renewal, so it would have passed against any implementation
including the broken one; the other asserted a forged field was ignored before there was anywhere to read
it. Both were rewritten to drive the real path, and the first then **failed** against the deliberately
broken derivation — which is the only evidence that a test of a derivation means anything.

**Two criteria are left open, and neither is a defect in this ticket's work.**

- *"An admission admitted before this ticket existed is given a bounded default rather than becoming
  permanent."* There is **no pre-existing admission to give a default to**, because no admission has ever
  persisted: the admissions module was created by this wave, and the store's demo seed holds grants, not
  admissions. The clause describes a migration from a state the product has never had. The expiry itself
  is real, chosen at admission, and asserted — by the time a stored admission could exist, it will carry
  one.
- *"The seam carries every assertion above for both the store and the running server."* The store half is
  complete. The "running server" half cannot be: **a browser cannot reach an admission**, for 08a's
  reason — a knock is an unauthenticated caller's act and the only credential is issued *on* admission, so
  there is nothing a client could present to knock with. Renewal is the same shape: it presents an expired
  credential, which no browser surface holds or offers.
