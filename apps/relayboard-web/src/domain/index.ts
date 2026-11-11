/**
 * The domain's public surface.
 *
 * Consumers import from `src/domain`, not from the files inside it, so the module
 * can grow a file per concern — permissions, the documented error strings, the
 * entry union's later members — without every importer moving.
 *
 * Types are re-exported from `./types`; the error vocabulary and the three entry helpers are the
 * module's runtime values. The strings exist here because they are observable behaviour rather than
 * messages a caller may reword, and the helpers exist because since 10a an entry is a union and
 * "what does this entry say" must be answered once, totally, rather than at each call site.
 */

export {
	entrySentence,
	entryText,
	isThreadStatus,
	movableTo,
	THREAD_STATUSES,
} from "./entries";
export type { ErrorMessages } from "./errors";
export { errorMessageList, errorMessages } from "./errors";
export type { Grant, PermissionName } from "./permissions";
export type {
	AcknowledgementEntry,
	ArtifactEntry,
	Board,
	BoardId,
	BoardTheme,
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
	StatusMoveEntry,
	Thread,
	ThreadId,
	ThreadStatus,
	Watermarks,
} from "./types";
