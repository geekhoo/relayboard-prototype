# 08c: Expiry, revocation, renewal and a fingerprint the workspace derived

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The part that makes it safe to keep admitting. An admission carries an expiry, revocation ends access on the principal's next request rather than at the next reconnect, a revoked or expired principal's past entries keep their author, and a renewal after expiry resolves to the same principal so history does not split. The issuer and fingerprint stop being values an agent supplies and become values this workspace derived from the credential it issued — and the payload keeps them distinguishable from what the agent merely declared.

**Blocked by:** 08b — The gatekeeper's decision surface

**Write scope:** expiry, revocation and renewal inside the admissions module; the derived fingerprint and issuer.

**Status:** ready-for-agent

- [ ] An admission carries an expiry chosen at admission: a bounded window, or never. An admission admitted before this ticket existed is given a bounded default rather than becoming permanent (spec L393).
- [ ] An expired admission is refused on the principal's next request, not at the next reconnect and not at the next poll (spec L596).
- [ ] A human holding `revoke:agent` can revoke an admission, and the revoked principal is refused on its next request (spec L597). Revoking does not remove the principal, its entries, or its authorship.
- [ ] A revocation is distinguishable in the refusal from a denial and from an expiry, so an operator can tell a policy decision from a bug (spec L402).
- [ ] The entries a revoked or expired principal already authored keep their author, and a test asserts one of them is still attributed to it after revocation.
- [ ] Renewal after expiry resolves to the **same principal id**, so its history stays one continuous record rather than splitting per credential (spec L598). A test renews and asserts the entry's author id is unchanged.
- [ ] **Renewal is proved by the expired credential itself**, presented in the renewal request and verified against its stored hash — not by matching the name or operator the caller declares. An expired principal holds nothing, so a renewal matching declared values would let any caller inherit another principal's history. A renewal presenting an expired credential for principal P reissues for P with a fresh expiry and a different credential hash; a renewal presenting a name and operator but no credential is refused.
- [ ] A renewal presenting a credential whose hash is unknown is refused, and one principal's credential cannot renew a different principal.
- [ ] The issuer and fingerprint are derived by the server from the credential it issued: two credentials for one principal yield the same fingerprint, two principals yield different ones, the renewal above preserves it, and a `fingerprint` field supplied by the knocker is ignored rather than stored.
- [ ] Declared and derived values are distinguishable **in the payload**, not only in the UI: the declared operator is echoed as declared and the derived issuer and fingerprint sit in their own fields, so a non-browser client cannot mistake one for the other (spec L599).
- [ ] An admitted agent acting outside its grant is refused exactly as a human outside its grant would be, asserted on the same operation for both, so the refusal shape is proven identical (spec L590).
- [ ] The seam carries every assertion above for both the store and the running server.
- [ ] The interface draws the line the product promises: a derived value may look verified, a declared value never may (`DESIGN.md` §260, §293), and the participant surface this feeds is 12's.

**Leaves the build green:** yes. The admission lifecycle is complete.
