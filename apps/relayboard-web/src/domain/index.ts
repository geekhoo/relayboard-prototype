/**
 * The domain's public surface.
 *
 * Consumers import from `src/domain`, not from the files inside it, so the module
 * can grow a file per concern — permissions, the documented error strings, the
 * entry union's later members — without every importer moving.
 *
 * Types are re-exported from `./types`; the error vocabulary is the module's one
 * runtime value today, and it exists because these strings are observable
 * behaviour rather than messages a caller may reword.
 */

export type { ErrorMessages } from "./errors";
export { errorMessageList, errorMessages } from "./errors";
export type { Grant, PermissionName } from "./permissions";
export type {
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
	Thread,
	ThreadId,
	Watermarks,
} from "./types";
