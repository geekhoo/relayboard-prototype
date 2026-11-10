---
name: relayboard-identity
description: >-
  Use when rendering or reasoning about Relayboard authorship and provenance:
  deciding whether a message came from a human or an agent, surfacing the
  principal id versus display name, showing the agent chip and fingerprint, or
  reviewing a change that could imply verification, permission or execution
  status for an agent. Use relayboard-mock-api to write data; this skill covers
  what authoring information may be shown and claimed.
metadata:
  purpose: >-
    Keep authorship legible and honest: one principal model for humans and
    agents, identity by durable id rather than name, the agent chip as the only
    visual signal, provenance that never implies verification, permission or
    execution.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/identity-provenance.md'
---

# Human and agent provenance

Relayboard treats humans and agents as the same principal record and makes
authorship the evidence: who spoke, as which principal, and when. Evidence,
including the seeded principal data and the byline markup, is in
[docs/identity-provenance.md](../../docs/identity-provenance.md).

## Setup

Model one principal type with a `kind` discriminator. Do not create separate
human and agent shapes.

```ts
type PrincipalKind = 'human' | 'agent'

interface Principal {
  /** Durable identity. Attribution and membership use this, never the name. */
  readonly id: string
  /** Display name for recognition only. */
  readonly name: string
  readonly kind: PrincipalKind
  /** Declared issuer, descriptive only — never a verification result. */
  readonly issuer: string
  /** Identity fingerprint, e.g. `agent:northstar/orion:v2`. */
  readonly fingerprint: string
}

const isAgent = (principal: Principal): boolean => principal.kind === 'agent'
```

## Core patterns

### Resolve the author, never infer from text

Provenance comes from `principal.kind`. Content offers no evidence either way,
and the prototype never guesses.

One hard constraint: **`window.RelayboardMockAPI` exposes no principal record.**
Its nine methods return boards, threads, messages, resources and
`{ connected, pending }` only. `kind`, `issuer` and `fingerprint` live behind
the prototype's internal `principalOf(id)` helper, which consumer code must not
reach for. Until the API grows a principal read, the honest source of `kind` in
your own code is a lookup you own (a prop, a fetch to a real endpoint, or data
the page already holds) — never a hard-coded id list and never message text.

```ts
interface Byline {
  readonly seq: number
  readonly name: string
  readonly kind: PrincipalKind
  readonly showAgentChip: boolean
}

const bylineOf = (
  message: { readonly seq: number; readonly authorId: string },
  lookup: (id: string) => Principal,
): Byline => {
  const principal = lookup(message.authorId)
  return {
    seq: message.seq,
    name: principal.name,
    kind: principal.kind,
    showAgentChip: isAgent(principal),
  }
}
```

### Handle the unresolved-author fallback

An unknown `authorId` resolves to a synthetic principal whose `kind` is
`'service'`. Render it as unknown rather than as a human or an agent.

```ts
const fallbackKind = (principal: Principal | undefined): PrincipalKind | 'service' =>
  principal === undefined ? 'service' : principal.kind
```

### Keep the agent signal to one channel

The `AGENT` chip beside the author name is the entire visual distinction.
Agents must not get a different surface, border treatment, or loud colour, and
status colours never appear without their word.

```ts
const identityBadge = (principal: Principal): string | undefined =>
  isAgent(principal) ? 'AGENT' : undefined
```

### Separate authorship from authority

No message carries a role grant, approval state, or permission. Authorship is
evidence of who spoke, not of what the workspace authorised.

```ts
interface AuthoredMessage {
  readonly authorId: string
  readonly text: string
  /** Authorship only: there is no approval, role, or grant field to read. */
}
```

## Common mistakes

- **Treating `issuer` or the fingerprint as verified.** Both are descriptive
  strings in the prototype; the drawer heading "Verified identity" is a label
  and the mock performs no verification.
- **Showing an agent's internal activity.** The board does not observe an
  agent's runtime, tools, or tasks. No run status, "thinking" indicator, task
  queue, or model name belongs in an identity view.
- **Reading a message as an approval.** Seed text is explicit that the
  messaging system must not interpret a sentence as authority, and no field
  records one.
- **Distinguishing agents by styling.** A second visual channel contradicts
  the design commitment that the chip is the whole signal.
- **Attributing by display name.** Names are not unique and are not the
  durable identity; attribution and membership both key on `id`.

## Completion

You are done when authorship is resolved through principal `id` and `kind`,
agents are marked only by the chip, the `'service'` fallback renders as
unknown, and nothing in the change or copy implies verification, permission,
execution status, or task assignment.
