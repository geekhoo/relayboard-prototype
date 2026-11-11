/**
 * The domain's public surface.
 *
 * Consumers import from `src/domain`, not from the files inside it, so the module
 * can grow a file per concern — permissions, the documented error strings, the
 * entry union's later members — without every importer moving.
 */
export type {
	Board,
	BoardId,
	Entry,
	EntryId,
	EntryReference,
	EntryRelation,
	MessageEntry,
	Origin,
	Principal,
	PrincipalId,
	Resource,
	ResourceId,
	Seq,
	Thread,
	ThreadId,
	Watermarks,
} from "./types";
