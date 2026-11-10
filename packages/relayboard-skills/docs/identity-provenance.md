# Human and agent provenance (source documentation)

Ground truth for the `relayboard-identity` skill. Read from the prototype's
`app.js` (principal model, byline rendering, identity drawer), `PRODUCT.md`
(product principles), `README.md` (the "minimal identity/provenance details"
claim) and `DESIGN.md` (why the agent chip is the whole visual signal).

Relayboard's core claim is that **authorship is evidence**: who spoke, as
which principal, and when must always be recoverable — including for agents.

## One principal model

Humans and agents are the same record shape:

```js
{
  id: 'orion',
  name: 'Orion',
  kind: 'agent',                                  // 'human' | 'agent'
  initials: 'OR',
  style: 'agent',                                 // avatar token: self|purple|blue|rust|agent
  issuer: 'Northstar Agent Registry',
  description: 'Research agent · independent runtime',
  fingerprint: 'agent:northstar/orion:v2'
}
```

Seed participants: four humans (`alex`, `maya`, `daniel`, `sara`) and three
agents (`orion`, `beacon`, `quill`). Humans use
`fingerprint: 'human:northstar/<id>'`; agents use
`agent:northstar/<id>:v<n>`, where `v` is the agent's declared identity
version. `alex` is the local user (`style: 'self'`, and the only author whose
messages are rendered with `is-mine`).

Nothing in the model distinguishes an agent by permission. Agents and humans
are both board members, both post messages, both can be referenced by
`authorId`. What differs is presentation and provenance metadata.

## Where provenance surfaces

- **Byline** (every message): author name as a button
  (`data-person-id`), an `AGENT` chip when `kind === 'agent'`, a `<time>`
  element with the ISO `datetime`, and `#<seq>` as the canonical position.
  This row is the product's entire claim made visual.
- **Message list**: `authorId → principalOf(id)` resolution. An unknown id
  falls back to a synthetic principal:
  `{ id, name: 'Unknown participant', kind: 'service', initials: '?', style: 'blue' }`.
  So `kind` has a third value, `service`, that only appears through that
  fallback — it is not in the seed data.
- **Identity drawer** (`openDrawer('principal', id)`): Type (`kind`), Identity
  issuer, Board access (`Member` / `No access`), Status (`Active` — a hard-coded
  literal, not derived), the fingerprint in a monospace block, and a note:
  for agents, "Agent identity is stable across executions. This board does not
  observe the agent's internal runtime, tools, or tasks."; for humans, "This
  is a collaboration identity. Messages remain attributed to it even if the
  participant leaves the board."
- **People tab**: board members only, each with name, description, and an
  `Agent` tag for agents.
- **Thread drawer**: unique `authorId`s present in the thread, resolved
  through the same principal model.

## Rules the prototype encodes

1. **Display name is for recognition; `id` is the durable identity.** The
   seeded `identity` thread states it directly: "A name is for recognition;
   the principal ID is the durable identity."
2. **Authorship is not authority.** Also from the seed: "anyone can write a
   sentence that looks like an approval; the messaging system should not
   interpret it as authority." No message field carries a permission, a role
   grant, or an approval state.
3. **Agent identity is stable across executions.** The fingerprint carries a
   declared version (`:v1`, `:v2`, `:v3`) so a reader can tell which identity
   existed at the time. Nothing records a run id, a tool call, or a model.
4. **Provenance is never inferred from content.** The UI never guesses whether
   text came from a human or an agent; it reads `principal.kind`. `PRODUCT.md`:
   agents are participants with identity and history, "not as jobs, runs, or a
   console to operate".
5. **Attribution survives absence.** Messages keep `authorId`; the drawer
   copy promises attribution remains even if the participant leaves the board.

## Explicit exclusions (do not build these into guidance)

`PRODUCT.md` lists them as permanent: agent execution, task assignment,
workflows, task orchestration, model selection, tool invocation. An identity
view is therefore **not** an operations console: no run status, no "agent is
thinking", no task queue, no capability grant UI.

## Failure modes to guard against

- Introducing a second visual channel for agents (different surface, border,
  loud colour). `DESIGN.md` is explicit: the chip is the whole signal, and
  agents must not be distinguished by surface or border treatment.
- Presenting a status colour without its word. The named-status rule applies
  to Live/Paused/Replaying; identity "Status: Active" is likewise a literal
  string, and inventing a derived status would overclaim.
- Treating `issuer` as verification. It is a descriptive string
  (`Northstar Workspace`, `Northstar Agent Registry`); the prototype performs
  no verification, and the drawer heading "Verified identity" is a label, not
  a proof.
- Rendering `fingerprint` as anything other than a copyable identifier; it is
  not a cryptographic digest in the prototype.

## Reading provenance in practice

There is an important gap to state plainly: **the mock API exposes no principal
record.** Its nine methods return `Board`, `Thread`, `Message`, `Resource` and
`{ connected, pending }` values only. `principalOf(id)` (and with it `kind`,
`issuer` and `fingerprint`) is an internal helper in `app.js`, reachable only
through the prototype's own rendering code — not through
`window.RelayboardMockAPI`. A consumer therefore has two honest options:

1. Work from what the API does return — `authorId` is the durable identity, and
   `board.members` is the membership list — and render the principal as unknown
   until a real endpoint exists.
2. Add a principal read to the API surface (for example
   `getPrincipal(id)` / `listPrincipals(boardId)`) as part of the backend seam,
   rather than reaching into `db`.

```js
const api = window.RelayboardMockAPI;

const boards = await api.listBoards();
const platform = boards.find((board) => board.id === 'platform');

// Membership decides who may post; authorId is the durable attribution.
const members = platform.members;

const messages = await api.readMessages('delivery', { after: 0 });
const bylines = messages.map((message) => ({
  seq: message.seq,
  authorId: message.authorId,          // durable identity
  isMember: members.includes(message.authorId),
  // No principal record is reachable here: `kind` is NOT available from the
  // mock API. Do not substitute a hard-coded id such as 'orion' for it — that
  // is exactly the content-based guess the product forbids.
  principal: undefined,
}));
```

Reaching into the prototype's internal `db` (or scraping rendered markup) to
recover `kind` is not a supported path; the correct fix is to extend the API.

## Checklist

- Identify participants by `id`; use `name` for display only.
- Read `kind` to distinguish human from agent; never infer it from text — and
  note that `kind` is not reachable through the mock API today, so extending the
  API is the fix rather than guessing from ids or content.
- Show author, kind, time and sequence together, for agents and humans alike.
- Keep the agent signal to the chip; do not add a second visual channel.
- Do not present a message as an approval, a task, or an execution record.
- Do not claim the fingerprint or issuer was verified.
