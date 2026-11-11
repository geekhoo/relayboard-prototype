import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	AdmissionRefused,
	type Admissions,
	createAdmissions,
	type DecidedRequest,
	type KnockReceipt,
	type PendingRequest,
	type PollResult,
} from "#/server/admissions";
import { ServerError } from "#/server/functions/errors";
import * as session from "#/server/session";
import { getStore } from "#/server/store/instance";

/**
 * The knock surface as server functions — **its own surface**, not members of `RelayboardClient`.
 *
 * Five operations, exactly as 08a:13 names them: `knock`, `pollAdmission`, `listPending`, `admit`,
 * `deny`. None appears on the participant interface, and a test asserts that from the interface's own
 * list rather than from this file.
 *
 * ## The three of them that a caller with no credential may reach
 *
 * `knock`, `pollAdmission` — and deliberately **not** `listPending`, `admit` or `deny`, which are a
 * gate holder's. The first two must work for an entity that is not a participant, so they resolve
 * nothing: calling `session.actingPrincipal()` here would **issue a browser session** to the knocker,
 * which would make an unadmitted agent a participant by the act of knocking.
 *
 * That is the inversion this surface makes, and it is why it is a separate module rather than five
 * more members: every operation on `RelayboardClient` begins by resolving a principal, and these two
 * must not.
 */

const admissions = (): Admissions => createAdmissions(getStore());

/** A refusal from the admission surface, in the transport's own error family. */
const admissionError = (error: unknown): ServerError => {
	if (error instanceof AdmissionRefused) {
		return new ServerError(
			error.reason === "unknown-request" ? "unknown-object" : "unresolved",
			error.message,
		);
	}
	throw error;
};

/**
 * A knock. **No credential is required and none is resolved.**
 *
 * The caller declares a name, an operator and a reason — all three asserted, never verified — and
 * gets back an id and a polling secret. Nothing else.
 */
export const knock = createServerFn({ method: "POST" })
	.validator(
		z.object({
			boardId: z.string().min(1),
			name: z.string().min(1),
			operator: z.string().min(1),
			reason: z.string().min(1),
		}),
	)
	.handler(async ({ data }): Promise<KnockReceipt> => {
		try {
			return admissions().knock(data);
		} catch (error) {
			throw admissionError(error);
		}
	});

/**
 * The knocker's own poll. No credential, and no session issued.
 *
 * A wrong secret answers exactly as an unknown request does, so the id cannot be probed.
 */
export const pollAdmission = createServerFn({ method: "POST" })
	.validator(
		z.object({
			requestId: z.string().min(1),
			pollingSecret: z.string().min(1),
		}),
	)
	.handler(async ({ data }): Promise<PollResult> => {
		try {
			return admissions().pollAdmission(data.requestId, data.pollingSecret);
		} catch (error) {
			throw admissionError(error);
		}
	});

/** What a gate holder sees. Requires `admit:agent` on the board, through 07a's table. */
export const listPending = createServerFn({ method: "GET" })
	.validator(z.object({ boardId: z.string().min(1) }))
	.handler(async ({ data }): Promise<readonly PendingRequest[]> => {
		const actor = session.actingPrincipal();
		try {
			return admissions().listPending(data.boardId, actor.id);
		} catch (error) {
			throw admissionError(error);
		}
	});

/** What a gate holder has already decided, so a denial does not vanish. */
export const decidedOn = createServerFn({ method: "GET" })
	.validator(z.object({ boardId: z.string().min(1) }))
	.handler(async ({ data }): Promise<readonly DecidedRequest[]> => {
		const actor = session.actingPrincipal();
		try {
			return admissions().decided(data.boardId, actor.id);
		} catch (error) {
			throw admissionError(error);
		}
	});

/** Admit. The granted set is bounded by 07b's rule, which this calls rather than restates. */
export const admit = createServerFn({ method: "POST" })
	.validator(
		z.object({
			requestId: z.string().min(1),
			permissions: z.array(z.string().min(1)),
			// Chosen in the same act as the set (08b:17): neither is defaulted silently, so the schema
			// requires it rather than filling one in. `never` is a value the caller states, not an
			// absence.
			expiry: z.union([
				z.object({
					kind: z.literal("bounded"),
					hours: z.number().int().positive(),
				}),
				z.object({ kind: z.literal("never") }),
			]),
		}),
	)
	.handler(async ({ data }): Promise<{ ok: true }> => {
		const actor = session.actingPrincipal();
		try {
			admissions().admit({
				requestId: data.requestId,
				grantedBy: actor.id,
				permissions: data.permissions as never,
				expiry: data.expiry,
			});
			return { ok: true };
		} catch (error) {
			throw admissionError(error);
		}
	});

/** Deny, with a reason the knocker will be told. */
export const deny = createServerFn({ method: "POST" })
	.validator(
		z.object({
			requestId: z.string().min(1),
			reason: z.string().min(1),
		}),
	)
	.handler(async ({ data }): Promise<{ ok: true }> => {
		const actor = session.actingPrincipal();
		try {
			admissions().deny({
				requestId: data.requestId,
				deniedBy: actor.id,
				reason: data.reason,
			});
			return { ok: true };
		} catch (error) {
			throw admissionError(error);
		}
	});
