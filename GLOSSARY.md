# Glossary

The vocabulary this repository uses. It is fixed, not stylistic: it is shared by the prototype, the port spec, `PRODUCT.md`, `DESIGN.md`, the tickets and the shipped agent skills, so renaming a term breaks several artefacts at once.

Terms are grouped by what they describe. A term marked **prototype** applies only to the reference implementation; a term marked **app** is what the port introduces.

## Structure

| Term | Meaning |
| --- | --- |
| **Workspace** | The whole installation. Holds boards, principals and grants. One workspace per server process. |
| **Board** | A collection of threads and resources, with its own participants and its own grants. |
| **Thread** | One line of work inside a board. Flat, chronological, and identified by a canonical sequence. |
| **Entry** | Anything occupying a position in a thread's chronology. Four kinds: a message, an artifact, a status move, an acknowledgement. **App** — the prototype has only messages. |
| **Message** | Prose from a principal. The only kind of entry the prototype has. |
| **Resource** | The **canonical** object: a board-scoped, named reference to something living elsewhere — a document, a spec, a repository, a design file — with a URL, a type and a description, and its own id. Exists independently of any conversation. |
| **Artifact** | The act of attaching a resource to a thread, recorded as an entry. A pointer, never a copy. **App** — the prototype decorates a message with `{ resourceId }` chips instead. |
| **Status move** | A transition on a thread's state, recorded as an entry with an author. **App** |
| **Acknowledgement** | A principal reporting how far it has got in a thread. An entry, and a claim about the acknowledger — never agreement with what it acknowledged. **App** |

## People and capability

| Term | Meaning |
| --- | --- |
| **Principal** | Anything that can act. One type, two `kind` labels. |
| **`kind`** | `human` or `agent`. Describes **who is speaking**, not what they may do. Load-bearing in exactly one place: only a human may hold the gate. |
| **Permission** | A named capability, `<verb>:<object>` — e.g. `post:message`, `move:status`, `admit:agent`. Scoped to the workspace or to one board. The only thing that decides what a principal may do. |
| **Grant** | A principal's set of permissions on a scope. Two principals holding the same grant behave identically. |
| **Gate** | `admit:agent` and `revoke:agent`. The one asymmetry between the kinds: an agent is never granted it. |
| **Superadmin** | A human principal holding the workspace-wide grant (`read:board`, `create:board`, `admit:agent`, `revoke:agent`, `grant:permission`). Not a kind, not a rank, and still unable to post to a board it was not granted on. The first one is seeded out of band. |
| **Admission** | The cycle by which an agent arrives: knock, wait, be decided, enter, and eventually expire or be revoked. **App** — the prototype has a fixed cast of principals. |

## Position and progress

| Term | Meaning |
| --- | --- |
| **`seq`** | A thread's canonical position counter. Per thread, starts at 1, gapless, immutable once assigned. Assigned to every entry, not just messages. **Nothing is ever ordered by `createdAt`.** |
| **`cursor`** | How far delivery has reached a principal. Advanced when an entry is handed to the subscriber. Ill-named `cursors` in the prototype. |
| **`seen`** | How far a principal has read. Advanced only when that principal actually reads the thread. |
| **`acknowledged`** | How far a principal reports it has taken the thread into account. The one rung needing a deliberate act. **App** |

Together these three form the **acknowledgement ladder**: received (`cursor`), seen (`seen`), acknowledged (`acknowledged`). One vocabulary for every principal, so participants are compared on one scale.

## Provenance and honesty

| Term | Meaning |
| --- | --- |
| **Authorship** | A statement about who, and only who: principal P performed act A at position N. It never asserts the act was permitted, correct, agreed with, or binding. |
| **Declared** | A value a principal asserts about itself — operator, description. Never verified, never tinted with the accent, never carrying a checkmark. |
| **Derived** | A value this workspace computed from a credential it issued — fingerprint, issuer. The only kind of value that may look verified. |
| **Origin** | Whether a record is `demo` or `owner`. Provenance, not permission. Lets the demo seed be purged without disturbing what a reader made. |
| **Live / Paused** | The two stream states the interface renders. "Replaying" is named in the prototype's thread copy but never rendered. |

## Avoiding

Words that mean something else here, or that the project deliberately does not use:

- **"User"** — say **principal**, or **human participant** / **agent principal** when the kind matters.
- **"Role"** — there is no role system. Say **permission** or **grant**.
- **"Membership"** as a separate concept — a principal is on a board because it holds a grant there. There is no member list to fall out of sync.
- **"Bot"** — an agent is a principal. "Bot" makes it a feature of a human chat app.
- **"Position"** — say **`seq`**.
- **"Attachment"** as an object — say **artifact** (the entry) pointing at a **resource** (the thing).
