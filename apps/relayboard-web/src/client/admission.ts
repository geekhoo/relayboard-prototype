import type { PermissionName } from "#/domain";
import type {
	DecidedRequest,
	Expiry,
	PendingRequest,
} from "#/server/admissions";
import {
	admit,
	decidedOn,
	deny,
	listPending,
} from "#/server/functions/admission";

/**
 * The gatekeeper surface's own client, **separate from `RelayboardClient`**.
 *
 * Spec L343-346 keeps admission off the participant interface, and 08a put it on its own surface for
 * a reason that still holds here: these operations are a *gate holder's*, and every operation on the
 * participant interface begins by resolving an acting principal. A component that needs them asks
 * this module, exactly as it asks `useRelayboardClient()` for everything else.
 *
 * It imports the server functions the way `http.ts` does — the definitions, which the plugin splits —
 * never `src/server/store/**`. `biome.json`'s `noRestrictedImports` keeps that honest for routes and
 * components; this file is the one sanctioned place the wire is named.
 *
 * `knock` and `pollAdmission` are deliberately **not** wrapped here. They belong to a caller with no
 * credential, and a browser component is never that caller: an agent knocks over the API, and a human
 * decides in the UI. Exposing them to the UI would invite a "knock as me" button, which is the one
 * thing the surface must not suggest.
 */
export interface GateClient {
	/** The pending requests for a board. Refused for a caller without `admit:agent` there. */
	listPending(boardId: string): Promise<readonly PendingRequest[]>;
	/** What this caller has already decided on that board, so a denial does not vanish. */
	decided(boardId: string): Promise<readonly DecidedRequest[]>;
	admit(input: {
		readonly requestId: string;
		readonly permissions: readonly PermissionName[];
		/** Chosen in the same act as the set, never defaulted silently (08b:17). */
		readonly expiry: Expiry;
	}): Promise<void>;
	deny(input: {
		readonly requestId: string;
		readonly reason: string;
	}): Promise<void>;
}

export const createGateClient = (): GateClient => ({
	listPending: async (boardId) =>
		(await listPending({ data: { boardId } })) as readonly PendingRequest[],
	decided: async (boardId) =>
		(await decidedOn({ data: { boardId } })) as readonly DecidedRequest[],
	admit: async (input) => {
		await admit({
			data: {
				requestId: input.requestId,
				permissions: [...input.permissions],
				expiry: input.expiry,
			},
		});
	},
	deny: async (input) => {
		await deny({ data: { requestId: input.requestId, reason: input.reason } });
	},
});
