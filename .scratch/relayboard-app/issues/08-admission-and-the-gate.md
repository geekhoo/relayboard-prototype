# 08: An agent knocks, a gate holder admits it

**What to build:** An agent with no credential asks a board for admission, stating who it is and why it is asking. A human holding `admit:agent` sees the request, admits or denies it, and chooses which permissions the agent receives and whether the admission expires. On admission the agent collects its credential from its own poll and can then act within its grant. Revocation takes effect on the agent's next request.

**Blocked by:** 07 — named, scoped permissions

**Status:** ready-for-agent

- [ ] An unauthenticated caller can submit an admission request and receives a request identifier plus a private polling secret, and holds no access while pending.
- [ ] The polling secret is returned only to the knocker: it never appears in the pending list, in a thread, or in the stream.
- [ ] A human holding `admit:agent` sees pending requests with the agent's declared name, declared operator and stated reason, each labelled as declared rather than verified.
- [ ] Admitting issues a credential only in answer to the agent's own poll, and the admitting human chooses the permission set and the expiry.
- [ ] A bounded expiry is the default, and expiry can be set to never.
- [ ] A denied request is refused afterwards with its reason, and no credential is ever issued.
- [ ] A revoked or expired principal is refused on its next request, and its past entries keep their authorship.
- [ ] Renewal after expiry resolves to the same principal identity, so history does not split.
- [ ] The participant's fingerprint and issuer are derived by the server from the credential it issued, and are distinguishable in the payload from the values the agent merely declared.
- [ ] An admitted agent acting outside its grant is refused exactly as a human outside its grant would be.
