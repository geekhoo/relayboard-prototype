# Human and agent provenance (source documentation)

Ground truth for the `relayboard-identity` skill. Read from
`apps/relayboard-web/src/client/index.ts` (`ParticipantRead`, `DeclaredValues`,
`DerivedIdentity`), `src/server/admissions.ts` (where a derived identity is computed),
`src/components/ParticipantPanel.tsx` (how derived and declared are rendered apart),
`src/components/Conversation.tsx` (the byline), `GLOSSARY.md` (the derived/declared
distinction), and `DESIGN.md` (why the agent chip is the whole visual signal).

Relayboard's core claim is that **authorship is evidence**: who acted, as which principal,
and at which position must always be recoverable — including for agents.

## One principal model

Humans and agents are the same record shape:

```ts
{
  id: 'orion';                                  // durable identity, never the name
  name: 'Orion';                                // recognition only
  kind: 'agent';                                // 'human' | 'agent' — a label, not a capability
  description: 'Research agent · independent runtime';   // DECLARED
}
```

A principal's capabilities are **not on this record**. They are a `Grant`, read through
`readPrincipal`, and a grant is what makes an action possible. `kind` is load-bearing in
exactly one place in the whole product: `admit:agent` and `revoke:agent` may only be held
by a human. Any other branch on `kind` is a bug.

The seed has four humans (`alex`, `maya`, `daniel`, `sara`), three agents (`orion`,
`beacon`, `quill`), a gate holder (`alex`), and a superadmin (`nadia`) who holds only
workspace grants and therefore cannot post to any board.

## Derived versus declared

`GLOSSARY.md` makes this distinction normative, and `ParticipantRead` carries it as two
separate fields:

| | **derived** | **declared** |
| --- | --- | --- |
| who produced it | this workspace | the principal |
| how | computed from a grant the workspace issued | asserted, in the principal's own words |
| fields | `issuer` (the admitting human), `fingerprint` (a keyed digest of the id) | `description`, and for a knocker `operator` and `reason` |
| trustworthy about | who admitted it, and that the id is the id | nothing but what the principal chose to say |
| present when | the workspace admitted it | always |

**The fingerprint is an HMAC over the principal id, keyed by the installation secret.**
It is stable across credentials, unique per principal, and impossible for a caller to
supply — which is exactly what makes it derived rather than asserted. The prototype's
identity drawer showed a hard-coded string (`agent:northstar/orion:v2`) under a heading
reading **"Verified identity"**; that heading is the mistake this split exists to prevent.

**`derived` is absent for a seeded principal.** The seed was never admitted through the
gate, so there is no admission record and nothing to derive one from. The panel says so in
words; inventing an issuer for a seeded human would be a derivation from nothing.

## Where provenance surfaces

- **The byline** on every entry: author name, an `AGENT` chip when the author is an agent,
  the time, and the entry's `#seq`.
- **The people view** lists a board's participants; each row opens the participant panel.
- **The participant panel** shows kind, the grant held on this board, derived and declared
  under separate headings, and three progress readouts.
- **The admission surface** shows a knocker's declared name, operator and reason —
  labelled declared, never verified.

## Rules the app encodes

1. **An entry carries an `authorId` and no kind.** The kind belongs to the author, so it is
   resolved through the principal read rather than copied onto the entry. An entry with a
   baked-in kind could disagree with the record after a change.
2. **Authorship is not authority.** No entry carries a role, a grant, an approval or a
   verdict. Being admitted grants nothing; holding more permissions than a human makes an
   agent no more of an authority.
3. **`kind` is a label, not a capability.** A human may hold less than an agent, and an
   agent may hold more than a human; neither ordering is a hierarchy.
4. **The chip is the whole visual signal.** No second channel — no different surface, no
   border treatment, no accent — distinguishes an agent.
5. **Declared is never accented and never checkmarked.** DESIGN.md keeps the accent for the
   one primary action per surface; a declared value taking it would read as verified.

## Explicit exclusions (do not build these into guidance)

No agent execution, task assignment, workflows, orchestration, model selection or tool
invocation. No run status, "thinking" indicator, task queue or model name in an identity
view: the board does not observe an agent's runtime, and showing one would imply the
product runs agents.

## Failure modes to guard against

- Treating `issuer` or the fingerprint as a verification of the *principal's* claims. Both
  are computed here, which makes them trustworthy about this workspace and says nothing
  about what the principal asserted.
- Labelling a declared value verified, or merging derived and declared into one bag of
  strings. The prototype's single heading is the shape of that mistake.
- Inventing a derived value for a principal the workspace never admitted.
- Reading an entry as approval, agreement or permission.
- Distinguishing agents by styling rather than by the chip.
- Attributing by display name: names are not unique and are not the durable identity.
- Substituting a hard-coded id list for the principal read — the app has one now, so that
  shortcut has no remaining justification.

## Reading provenance in practice

```ts
const panel = await client.readPrincipal({ principalId: 'orion', boardId: 'platform' });

panel.principal.kind;      // 'agent' — a label
panel.grant.permissions;   // what it may do HERE, and nothing outside this board
panel.declared.reason;     // what it said, not what was checked
panel.derived?.fingerprint // present only if this workspace admitted it
```

A refused read (no `read:member`) is a distinct sentence from a read that found nothing:
the first says a permission is missing, the second says the principal is not here.

## Checklist

- [ ] Authorship resolves through `readPrincipal` and the principal's `id`.
- [ ] Agents are marked only by the chip.
- [ ] Derived and declared are rendered under separate headings, and nothing declared is
      labelled verified.
- [ ] An absent derivation is stated in words rather than faked.
- [ ] Progress is three readouts, not one bar.
- [ ] Nothing in the change or copy implies verification, permission, execution or task
      assignment.
