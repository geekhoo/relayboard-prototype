/**
 * The record types the store, the client interface and the tests share.
 *
 * This module is types only: no I/O, no store, no rules. The rules that operate on
 * these types arrive with the store (02b); this file is the vocabulary they are
 * written in, so a test can name the thing it asserts on before anything exists
 * that could assert it.
 *
 * The vocabulary is fixed by `GLOSSARY.md` — Board → Thread → **entry**,
 * `Principal`, `Resource`, `Origin`, `seq`, and the three watermarks — so the
 * names here are not free choices.
 */

/** Where a record came from. Provenance, never permission: a purge removes `demo` records and cannot see `owner` ones. */
export type Origin = "demo" | "owner";

/**
 * The four hues a board's mark may take.
 *
 * `DESIGN.md` §241 makes "30px rounded-square board marks at 4 hues" normative, so the
 * set is closed here rather than left a string the rail would have to guess at. The
 * prototype uses `sage`, `ochre` and `lavender` for its three boards and `blue` as
 * the default for a board created in the app (`app.js` L116).
 */
export type BoardTheme = "sage" | "ochre" | "lavender" | "blue";

/**
 * A thread's canonical position. Per thread it starts at 1 and is gapless,
 * immutable once assigned, and assigned to every entry rather than only messages.
 * Nothing in this product orders by `createdAt`; `seq` is the order.
 *
 * It is a plain number rather than a branded type because every producer of one is
 * the store, and a brand would only move a cast into the seed and the fixtures
 * without preventing a mistake the type could have caught.
 */
export type Seq = number;

// Identifiers are strings. Naming them separately keeps a `boardId` from being
// passed where a `threadId` belongs, and reads the way the spec and the tickets
// write them (`ThreadId`, `PrincipalId`, …).
export type PrincipalId = string;
export type BoardId = string;
export type ThreadId = string;
export type EntryId = string;
export type ResourceId = string;

/**
 * Anything that can act. One type, two `kind` labels.
 *
 * `kind` describes **who is speaking**, not what they may do: what a principal may
 * do comes from a grant, so a human can hold less than an agent and an agent more
 * than a human. Nothing here branches on `kind`, and the one rule that does —
 * `admit:agent` and `revoke:agent` may only be granted to a human — belongs to the
 * permission module (ticket 07b), not to this record.
 */
export interface Principal {
	readonly id: PrincipalId;
	readonly name: string;
	readonly kind: "human" | "agent";
	readonly origin: Origin;
	/**
	 * What the principal says about itself — its operator, its role, its runtime.
	 *
	 * **Declared, never verified.** The prototype carries the same string on every
	 * principal (`app.js` L21-27) and its drawer shows it under "Verified identity";
	 * ticket 12 must label this one as declared and keep anything derived separate
	 * (`GLOSSARY.md`: "Declared — never verified, never tinted with the accent, never
	 * carrying a checkmark").
	 */
	readonly description: string;
	/**
	 * Whether a browser session may be issued this principal.
	 *
	 * A fact about the demo seed, not a capability: spec L368 says the first request
	 * names a principal "selected round-robin from those the seed marks as
	 * browser-selectable", with L370 making the selection cyclic and stable within one
	 * store instance. It says nothing about what the principal may do, which is its
	 * grant and only its grant (07a). A principal that is not selectable is still a
	 * participant that can act.
	 */
	readonly browserSelectable: boolean;
}

/** A board-scoped named reference to something living elsewhere — a document, a spec, a repository, a design file. */
export interface Resource {
	readonly id: ResourceId;
	readonly boardId: BoardId;
	readonly name: string;
	readonly url: string;
	/**
	 * How the resource is described, e.g. `Document` or `Repository`. Ticket 09
	 * closes this into a named set; until it does, the type stays open rather than
	 * guessing the members here.
	 */
	readonly type: string;
	readonly description: string;
	readonly origin: Origin;
}

/**
 * A collection of threads and resources, with its own participants and its own
 * grants.
 *
 * There is no member list: a principal is on a board because it holds a grant on
 * that board, and a list beside the grants would be a second source of truth that
 * can disagree with the first.
 */
export interface Board {
	readonly id: BoardId;
	readonly name: string;
	/**
	 * The monogram a 30px rounded-square board mark shows — one character.
	 *
	 * The prototype stores it (`app.js` L30-32: `short: 'P'`) and `createBoard` derives
	 * it from the name's first letter (`app.js` L116), so a board made through the app
	 * has one too freezes the mark rather than re-deriving it at each render.
	 */
	readonly short: string;
	/** Which of the four documented hues the mark takes. Closed, because a fifth would render unstyled. */
	readonly theme: BoardTheme;
	readonly description: string;
	readonly origin: Origin;
}

/**
 * The thread's state, and the whole of it.
 *
 * **A closed set of two, and the closure is the point.** A free-text status would make `moveStatus` a
 * write that records a string rather than a transition a reader can check — and the transition rule
 * ("a move from a status the thread is not in is refused") is only meaningful if the set of statuses
 * is knowable. The two members are the ones the repository already speaks: the interface's stub for
 * the operation has always read `from: "open", to: "resolved"`
 * (`tests/contract/operations.conformance.ts`), and inventing a third here would be 10a deciding
 * product vocabulary no ticket asked it to decide. Widening the set is a one-line change to this
 * union plus the store's guard; doing it silently is what this comment exists to prevent.
 */
export type ThreadStatus = "open" | "resolved";

/**
 * One line of work inside a board. Flat, chronological, identified by its own
 * `seq` counter.
 *
 * Like `Board`, it carries no member list — the grant is the membership — and no
 * array of its contents: the chronology is read from the store and grows into a
 * union of entry kinds, so freezing it into the thread record is the coupling this
 * ticket exists to prevent.
 */
export interface Thread {
	readonly id: ThreadId;
	readonly boardId: BoardId;
	readonly title: string;
	/** The principal that started the thread, kept so the thread intro can name it. */
	readonly creatorId: PrincipalId;
	/**
	 * Whether the thread is pinned.
	 *
	 * Carried because the prototype carries it (`app.js` L35 pins exactly one seeded thread) and
	 * renders a pin beside it. It is a **label, not a sort key**: measured against the prototype,
	 * the thread list's sort (L142) orders by the latest entry's timestamp and never consults this
	 * — so a pinned thread appears wherever its recency puts it, and the pin only marks it. Ticket
	 * 04b records that as the decision it was asked for rather than dropping the field silently.
	 */
	readonly pinned: boolean;
	/**
	 * Where the thread stands, moved only by a `status-move` entry.
	 *
	 * **Derived from the chronology and stored alongside it**, which is the one place this app keeps the
	 * same fact twice — and the reason is that a move is an *event* that a reader must be able to see in
	 * history (`from → to`), while the current state is what a control needs before it offers a move.
	 * Recomputing it from the last status-move entry on every read would be correct but would make a
	 * synchronous read O(entries); storing it and writing it only inside the one path that appends a
	 * status-move entry is what keeps the two from disagreeing — there is no second writer.
	 */
	readonly status: ThreadStatus;
	readonly createdAt: string;
	readonly origin: Origin;
}

/** A reference an entry makes to a resource, by id. Never the resource's content. */
export interface EntryReference {
	readonly resourceId: ResourceId;
}

/**
 * What an entry says about another entry.
 *
 * The seed's one instance is a correction pointing at an earlier entry
 * (`app.js` L57, `{ messageId: 'seed-delivery-5', type: 'In response to' }`), which
 * is why the target is named by entry rather than by message: the union widens and
 * the target keeps its meaning. Pointing at an entry never changes that entry's
 * `seq` — a correction is a new entry, not an edit.
 */
export interface EntryRelation {
	/** The label the entry gives its target, in the prototype's own words. */
	readonly type: string;
	readonly entryId: EntryId;
}

/**
 * The fields every entry carries, whatever its kind. A position in the thread's
 * chronology, who took it, when, and where the record came from.
 */
interface EntryBase {
	readonly id: EntryId;
	/** Position in this thread, from the same counter for every kind of entry. */
	readonly seq: Seq;
	readonly authorId: PrincipalId;
	readonly createdAt: string;
	readonly origin: Origin;
	/** Present only when the entry refers to an earlier one; absent means no relation. */
	readonly relation?: EntryRelation;
}

/**
 * Prose from a principal.
 *
 * `references` carries the prototype's resource chips (`app.js` L53) so the demo
 * seed can be transcribed with them; ticket 10a turns an attached resource into an
 * artifact entry of its own, and an artifact holds the resource id rather than any
 * of its content.
 */
export interface MessageEntry extends EntryBase {
	readonly kind: "message";
	readonly text: string;
	readonly references: readonly EntryReference[];
}

/**
 * A resource attached to a thread: a pointer, never a copy (spec L435).
 *
 * It carries the resource **id** and nothing else about the resource — no name, no url, no
 * description. That is the whole rule: two threads attaching one resource produce two entries and one
 * resource record, and editing the resource changes what both entries resolve to because neither holds
 * a copy. A test asserts there is exactly one resource record after two attachments.
 */
export interface ArtifactEntry extends EntryBase {
	readonly kind: "artifact";
	readonly resourceId: ResourceId;
}

/**
 * A transition on the thread's state, recorded with its author.
 *
 * `from` is kept as well as `to` because the transition is the event: a reader can see the thread went
 * from open to resolved, rather than only that it is resolved now. The store refuses a move whose
 * `from` is not the thread's current status, so a stale control cannot silently move a thread twice.
 */
export interface StatusMoveEntry extends EntryBase {
	readonly kind: "status-move";
	readonly from: ThreadStatus;
	readonly to: ThreadStatus;
}

/**
 * A principal reporting how far it has got.
 *
 * **A report about the acknowledger, never agreement with what it acknowledged** (spec L438, DESIGN.md
 * §295). It carries the position it reaches and the position it started from, and it carries no verdict
 * field of any kind — no `approved`, no `agreed`, no boolean that could be read as one. `fromUpTo` is
 * the acknowledger's watermark immediately before the act, so the entry states the range it covers even
 * when the reader's own watermark has since moved past it.
 */
export interface AcknowledgementEntry extends EntryBase {
	readonly kind: "acknowledgement";
	/** The position this acknowledgement acknowledges up to. */
	readonly upTo: Seq;
	/** The acknowledger's acknowledged watermark before this act — the other end of the range. */
	readonly fromUpTo: Seq;
}

/**
 * Anything occupying a position in a thread's chronology.
 *
 * A discriminated union over `kind` with four members: a message, an artifact, a status move and an
 * acknowledgement. Every consumer is typed against `Entry` rather than against `MessageEntry`, which is
 * what makes the widening an addition rather than a refactor of every reader.
 *
 * **An act is an entry, not a parallel record** (spec L450). A status move, an artifact and an
 * acknowledgement take a `seq` from the **same counter** as a message, so there is one timeline and a
 * reader never reconciles the conversation against a separate audit log. The consequence is that the
 * ordering rule holds for every kind: order by `seq`, never by `createdAt`.
 */
export type Entry =
	| MessageEntry
	| ArtifactEntry
	| StatusMoveEntry
	| AcknowledgementEntry;

/**
 * How far one principal has got in one thread, on the three-rung ladder every
 * principal is measured on: received (`cursor`), read (`seen`), acknowledged
 * (`acknowledged`).
 *
 * The three are kept separate because they diverge on purpose: pausing the stream
 * holds `cursor` still while `seen` can move, and `acknowledged` moves only when a
 * principal deliberately says so. `cursor` and `seen` are per
 * `(principal, thread)`, so two principals following one thread are each at their
 * own point and neither advances the other's.
 */
export interface Watermarks {
	/** How far delivery has reached this principal: advanced when an entry is handed to the subscriber. */
	readonly cursor: Seq;
	/** How far this principal has read: advanced only when it actually reads the thread. */
	readonly seen: Seq;
	/** How far this principal reports it has taken the thread into account: the one rung that needs a deliberate act. */
	readonly acknowledged: Seq;
}
