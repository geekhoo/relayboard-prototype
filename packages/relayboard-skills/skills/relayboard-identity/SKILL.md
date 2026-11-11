---
name: relayboard-identity
description: >-
  Use when rendering or reasoning about Relayboard authorship and provenance:
  deciding whether an entry came from a human or an agent, showing a principal's
  id versus display name, rendering the agent chip, or showing the issuer and
  fingerprint a workspace derived versus what a principal declared — and when
  reviewing a change that could imply verification, permission or execution for
  an agent. Use relayboard-mock-api to write entries; this skill covers what
  authorship information may be shown and claimed.
metadata:
  purpose: >-
    Keep authorship legible and honest: one principal model for humans and agents,
    identity by durable id rather than name, the agent chip as the only visual
    signal, derived kept separate from declared, and provenance that never implies
    verification, permission or execution.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/identity-provenance.md'
---

# Human and agent provenance

Relayboard treats humans and agents as the same principal record and makes authorship
the evidence: who acted, as which principal, and at which position. The app resolves
it through **one board-scoped principal read** — `readPrincipal({ principalId,
boardId })`, gated by `read:member` — and never off a board payload. Evidence, including
the seeded records and the byline markup, is in
[docs/identity-provenance.md](../../docs/identity-provenance.md).

## Setup

Model one principal type with a `kind` discriminator. Do not create separate human and
agent shapes. **`kind` is a label, not a capability**: what a principal may do comes from
a named grant, and `kind` is load-bearing in exactly one place — `admit:agent` and
`revoke:agent` may only be held by a human.

```ts
type PrincipalKind = 'human' | 'agent'

interface Principal {
  /** Durable identity. Attribution and membership use this, never the name. */
  readonly id: string;
  /** Display name for recognition only. */
  readonly name: string;
  readonly kind: PrincipalKind;
}

const isAgent = (principal: Principal): boolean => principal.kind === 'agent';
```

## Core patterns

### Resolve the author, never infer it from text or a hard-coded list

Every entry carries `authorId` and **no kind** — the kind belongs to the author, not to
what they wrote. Resolve it through `readPrincipal`, which is also where the grant comes
from. A hard-coded id list is the defect this prohibition exists to prevent: an agent's
kind would then live in two places and the entry could disagree with the record.

```ts
interface Byline {
  readonly seq: number;
  readonly name: string;
  readonly kind: PrincipalKind;
  readonly showAgentChip: boolean;
}

const bylineOf = (
  entry: { readonly seq: number; readonly authorId: string },
  participant: ParticipantRead,
): Byline => ({
  seq: entry.seq,
  name: participant.principal.name,
  kind: participant.principal.kind,
  showAgentChip: isAgent(participant.principal),
});
```

### Keep derived separate from declared — and never label declared verified

`ParticipantRead` splits the two, and the split is the point:

- **`derived`** — what **this workspace computed** from a grant it issued: the issuer
  (the human whose grant admitted it) and a fingerprint that is a keyed digest of the
  principal id. Stable, unique, and impossible for the caller to supply. **Absent for a
  principal this workspace never admitted** — a seeded human has no admission record, and
  the panel says so in words rather than inventing one.
- **`declared`** — what the principal **asserted about itself**: a description, and for an
  agent that knocked, its operator and its reason. Never verified, never tinted with the
  accent, never carrying a checkmark.

```ts
const label = (read: ParticipantRead): string =>
  read.derived === undefined
    ? 'This participant was not admitted here, so there is nothing derived about it.'
    : `Derived by this workspace: issued by ${read.derived.issuer}`;
```

The prototype's identity drawer showed both under one heading reading **"Verified
identity"** and carried a hard-coded fingerprint. That heading is the mistake this
split exists to prevent: a derived value may look verified, and a declared one never may.

### Keep the agent signal to one channel

The `AGENT` chip beside the author name is the entire visual distinction. Agents get no
different surface, border, or loud colour, and a status colour never appears without its
word.

```ts
const identityBadge = (principal: Principal): string | undefined =>
  isAgent(principal) ? 'AGENT' : undefined;
```

### Separate authorship from authority

No entry carries a role grant, an approval state or a permission. Authorship is evidence
of who acted, not of what the workspace authorised — and this holds twice for agents,
because **being admitted grants nothing**. A principal's capabilities are the grant the
principal read returns, and nothing else.

### Showing progress is three readouts, not a bar

A participant's progress on a thread is received / seen / acknowledged, three numbers
with three meanings. A single bar would merge them and imply a completion the model does
not have.

### What a reader can do now that the principal read exists — and what it still cannot claim

This skill was excluded from the app's allowlist for a while, and the exclusion was honest at
the time: the prototype exposed no principal read, so `kind`, the grant, the issuer and the
fingerprint were all unreachable from consumer code, and the only options were to render
"unknown" or to hard-code an id list. **The app has `readPrincipal` and a session, so the
exclusion is gone.** A reader can now:

- resolve an entry's author to a record, and its `kind`, without a hard-coded list;
- show **what the principal may do on this board** (the grant) beside who it is, which is the
  question a reader actually has when they see an unfamiliar agent in a thread;
- show a **derived** issuer and fingerprint where the workspace admitted the principal, and say
  plainly where it did not;
- tell a permission refusal from an absent session, because the read separates them.

**What it still cannot honestly claim:** a credential **identifies; it does not authenticate**.
The fingerprint proves the id is the id this workspace recorded — not that the principal is
who it says it is, not that its operator controls it, and not that anything it wrote is
correct. Any copy that turns a derived value into a guarantee of authenticity is the same
mistake as the prototype's "Verified identity" heading, one abstraction further out.

## Common mistakes

- **Treating `issuer` or the fingerprint as verified.** Both are computed here, which
  makes them trustworthy *about this workspace* and says nothing about the principal's
  claims. The declared block is never labelled verified.
- **Inventing a derived value for a seeded principal.** No admission record means no
  derivation; say that in words.
- **Showing an agent's internal activity.** The board does not observe an agent's runtime,
  tools or tasks. No run status, "thinking" indicator, task queue or model name belongs in
  an identity view.
- **Reading an entry as an approval.** No field records one, and copy must not imply it.
- **Distinguishing agents by styling.** A second visual channel contradicts the design
  commitment that the chip is the whole signal.
- **Attributing by display name.** Names are not unique and are not the durable identity;
  attribution and membership both key on `id`.
- **Reading a credential as authentication.** It identifies. The derived fingerprint is
  evidence *about this workspace's record*, and nothing about the principal's honesty.
- **Rendering the grant as a status.** "Holds `admit:agent`" is a capability, not a rank; it
  must not be shown as a badge that reads as seniority.

## Completion

You are done when authorship resolves through `readPrincipal` and its `id`, agents are
marked only by the chip, derived and declared are rendered under separate headings with
nothing declared labelled verified, an absent derivation is stated rather than faked,
progress is three readouts, and nothing in the change or copy implies verification,
permission, execution status or task assignment.
