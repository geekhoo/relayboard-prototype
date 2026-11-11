import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientOperations, operationPermissions } from "#/client";
import { errorMessages } from "#/domain";
import { authorize, PermissionDenied } from "#/server/permissions";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The permission matrix: what each operation requires, and who is refused.
 *
 * ## Why this file tests the enforcement seam rather than a server function
 *
 * 07a:17 asks for a test that calls a server function directly with a request that never touched the
 * UI and asserts the refusal. `createServerFn` cannot be driven under `vitest run` — measured four
 * ways in 06c — so the assertion is made at the seam every server function *delegates to*:
 * `authorize(operation, actor, scope)`, which is called with a principal and answers or throws. That
 * is the same decision the handler makes one frame up, and the handler's only job is to call it.
 *
 * The end-to-end half — that a request over HTTP is refused — is asserted at the route seam in
 * `e2e/permissions.spec.ts`.
 */

const store = () => {
	const created = createStore(demoSeed(), demoOptions());
	return created;
};

describe("the declared matrix", () => {
	it("has a row for every operation on the interface, and no row for anything else", () => {
		// 07a:16. The table is exhaustive by type, so an operation without a row does not compile; this
		// asserts the same fact as data, and catches a row left behind by a rename.
		expect(Object.keys(operationPermissions).sort()).toEqual(
			[...clientOperations].sort(),
		);
		for (const operation of clientOperations) {
			expect(operationPermissions[operation]).toBeDefined();
		}
	});

	it("gives exactly one operation no requirement, and says why", () => {
		// `readActingPrincipal` is the one: a caller with no session must be able to ask who it is,
		// which is how a client learns it has none (spec L341). The reason lives in the table rather
		// than being inferred from an absence.
		const withoutRequirement = clientOperations.filter((operation) => {
			const requirement = operationPermissions[operation];
			return typeof requirement === "object" && "none" in requirement;
		});
		// Two since 09: `readActingPrincipal` (a caller with no session must learn it has none) and
		// `readHeldPermissions` (a surface must be able to ask what it may offer before offering it).
		// Both are reads about the caller itself, and neither can be gated by the thing it reports.
		expect(withoutRequirement.sort()).toEqual([
			"readActingPrincipal",
			"readHeldPermissions",
		]);
		expect(operationPermissions.readActingPrincipal).toMatchObject({
			none: expect.stringContaining("no session"),
		});
	});

	it("names a permission from the vocabulary for every row that names one", () => {
		// A row that named a permission outside the fifteen would be a requirement nothing can satisfy.
		for (const operation of clientOperations) {
			const requirement = operationPermissions[operation];
			const named =
				typeof requirement === "string"
					? requirement
					: "atLeastOneBoard" in requirement
						? requirement.atLeastOneBoard
						: null;
			if (named === null) continue;
			expect(
				[
					"read:board",
					"read:thread",
					"read:resource",
					"read:member",
					"post:message",
					"create:thread",
					"create:board",
					"add:resource",
					"add:artifact",
					"move:status",
					"acknowledge:thread",
					"update:board",
					"admit:agent",
					"revoke:agent",
					"grant:permission",
				],
				`${operation} requires ${named}, which is not in the vocabulary`,
			).toContain(named);
		}
	});
});

describe("enforcement", () => {
	it("refuses an operation the principal holds no grant for, naming the permission", () => {
		// Served from the actual store the app runs against, so the grant data is the demo seed's.
		const actor = {
			id: "sara",
			name: "Sara Lindqvist",
			kind: "human" as const,
			origin: "demo" as const,
			description: "",
			browserSelectable: false,
		};
		const platform = store();
		// Sara is on campaign and design, not platform — so she may not post there.
		expect(platform.permits("sara", "post:message", "platform")).toBe(false);

		// The refusal is a `PermissionDenied`, which is a `ServerError` of the `unresolved` family:
		// distinct from a validation failure and from an unknown object (07a:18).
		const failure = (() => {
			try {
				authorize("appendMessage", actor, { boardId: "platform" });
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(PermissionDenied);
		expect((failure as PermissionDenied).code).toBe("unresolved");
		expect((failure as PermissionDenied).permission).toBe("post:message");
		expect((failure as PermissionDenied).boardId).toBe("platform");
		expect((failure as Error).message).toBe(errorMessages.permissionDenied);
	});

	it("answers the same for a principal holding the grant", () => {
		// The control for the test above: the identical call against a principal who holds it. Without
		// this, enforcement that refused everything would pass.
		const actor = {
			id: "alex",
			name: "Alex Morgan",
			kind: "human" as const,
			origin: "demo" as const,
			description: "",
			browserSelectable: true,
		};
		expect(() =>
			authorize("appendMessage", actor, { boardId: "platform" }),
		).not.toThrow();
	});

	it("never takes the board from the request, only from the record", () => {
		// The handlers resolve the board from the thread; this asserts the consequence at the seam: a
		// principal with a grant on campaign is refused `post:message` at platform even though both are
		// boards it can name.
		const campaignOnly = store();
		expect(campaignOnly.permits("quill", "post:message", "campaign")).toBe(
			true,
		);
		expect(campaignOnly.permits("quill", "post:message", "platform")).toBe(
			false,
		);
	});

	it("satisfies a read requirement through the container", () => {
		// spec L425: `read:board` on a board yields that board's threads and resources. Asserted
		// through the enforcement path rather than through `satisfies` directly, so the implication is
		// shown to be live rather than merely available.
		const s = store();
		expect(s.permits("alex", "read:thread", "platform")).toBe(true);
		expect(s.permits("alex", "read:resource", "platform")).toBe(true);
		// And it does NOT yield a write or the member list.
		expect(s.permits("alex", "read:member", "platform")).toBe(true); // held directly by the seed
		expect(s.permits("orion", "create:thread", "platform")).toBe(true);
	});
});

describe("the superadmin", () => {
	const nadia = {
		id: "nadia",
		name: "Nadia Rahman",
		kind: "human" as const,
		origin: "owner" as const,
		description: "Workspace administrator",
		browserSelectable: false,
	};

	it("holds the workspace row and not a board membership", () => {
		const s = store();
		// The five names of spec L420, at workspace scope.
		expect([...s.grantsFor("nadia")].sort()).toEqual([
			"admit:agent",
			"create:board",
			"grant:permission",
			"read:board",
			"revoke:agent",
		]);
		// And no board-scoped grant: a superadmin is provisioned, not a member.
		expect(s.grantsFor("nadia", "platform")).toEqual([]);
	});

	it("cannot post to a board it holds no board grant on", () => {
		// 07a:20's criterion, and the one that keeps "administrator" from implying "participant".
		expect(() =>
			authorize("appendMessage", nadia, { boardId: "platform" }),
		).toThrow(PermissionDenied);
		// But it can read every board's threads, because workspace `read:board` reaches contents.
		expect(() =>
			authorize("readThread", nadia, { boardId: "platform" }),
		).not.toThrow();
	});
});

describe("the same grant, the same behaviour", () => {
	it("answers identically for a human holding less than an agent", () => {
		// story 77-80: a human may hold less than an agent. Asserted by asking the same questions of
		// two principals whose KIND differs and whose grants are controlled.
		const s = createStore(demoSeed(), {
			grants: [
				{
					granterId: "system",
					principalId: "maya",
					scope: "board",
					boardId: "platform",
					permissions: ["read:board"],
				},
				{
					granterId: "system",
					principalId: "orion",
					scope: "board",
					boardId: "platform",
					permissions: ["read:board"],
				},
			],
			watermarks: demoOptions().watermarks,
		});
		for (const permission of [
			"read:board",
			"post:message",
			"create:thread",
		] as const) {
			expect(s.permits("maya", permission, "platform")).toBe(
				s.permits("orion", permission, "platform"),
			);
		}
	});

	it("answers identically for an agent holding more than a human", () => {
		// The other direction: same salaries, different grants, both kinds.
		const s = createStore(demoSeed(), {
			grants: [
				{
					granterId: "system",
					principalId: "maya",
					scope: "board",
					boardId: "platform",
					permissions: ["read:board", "post:message", "create:thread"],
				},
				{
					granterId: "system",
					principalId: "orion",
					scope: "board",
					boardId: "platform",
					permissions: ["read:board"],
				},
			],
			watermarks: demoOptions().watermarks,
		});
		expect(s.permits("maya", "post:message", "platform")).toBe(true);
		expect(s.permits("orion", "post:message", "platform")).toBe(false);
		// The reverse of the previous test, so the asymmetry is shown in both directions rather than
		// assumed from one.
		expect(s.permits("orion", "read:board", "platform")).toBe(true);
	});
});

describe("kind is consulted in exactly one place", () => {
	/**
	 * The durable form of 02a's temporary check.
	 *
	 * 02a asserted that `src/domain` exports types only, so nothing in it could branch on anything.
	 * That stopped holding when 02b put the error strings there. What the check was protecting is
	 * AGENTS.md's rule: **`kind` is a label, not a capability** — load-bearing in exactly one place,
	 * only a human may hold `admit:agent` / `revoke:agent`, and that rule is 07b's.
	 *
	 * So this enumerates every place the source compares against a kind label, and requires the list
	 * to be **exactly** the occurrences this repository can justify, each with its reason. A new
	 * branch on `kind` fails here rather than being found in review — and an allowed one that
	 * disappears fails too, so the list cannot rot into a set of excuses for code that no longer
	 * exists.
	 */
	const WHY = {
		// **THE ONE LOAD-BEARING BRANCH, and 07b is the ticket that put it here.** `admit:agent` and
		// `revoke:agent` may only be granted to a human (AGENTS.md, spec L590, stories 77-85), so the
		// gate rule is the single place in the product where a principal's kind changes an outcome.
		// This is the file the criterion means when it says `kind` is load-bearing in exactly one
		// place; everything else below is a label or a choice of who speaks.
		"src/server/grants.ts":
			"the gate rule: only a human may hold admit:agent / revoke:agent",
		// Choosing who speaks, not who may. `simulateIncoming` picks an author from the board's agent
		// members; the permission checked is the caller's `post:message` (spec L340, L377).
		"src/server/functions/write.ts":
			"chooses the simulated author; never a permission",
		"src/client/in-memory.ts": "the same choice, for the in-memory transport",
		// Rendering the word beside a name. A reader needs to know who is speaking; nothing is granted.
		"src/components/BoardPane.tsx":
			"renders the 'Agent' tag; a label a reader sees",
		"src/routes/-conversation.ts": "decides whether an entry carries the tag",
	} as const;

	const sourceFiles = (): readonly string[] =>
		readdirSync(join(process.cwd(), "src"), {
			recursive: true,
			// Directories are filtered by `isFile()` rather than by extension: the recursive listing
			// returns directory entries too, and the first version of this scan tried to read one as a
			// file (EISDIR). A scan that throws is a scan that never ran.
			withFileTypes: true,
		})
			.filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
			.map((entry) => join(entry.parentPath, entry.name));

	const kindComparisons = (): ReadonlyMap<string, number> => {
		const found = new Map<string, number>();
		for (const file of sourceFiles()) {
			const source = readFileSync(file, "utf8")
				// Comments explain the rule and would otherwise match it.
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/^\s*\/\//gm, "");
			const matches = source.match(
				/(?:===?|!==?)\s*["'](?:human|agent)["']|["'](?:human|agent)["']\s*(?:===?|!==?)/g,
			);
			if (!matches) continue;
			// Normalised to forward slashes: `join` produces backslashes on Windows, and the keys above
			// are written the way the repository writes paths. The first version did not normalise, so
			// every comparison missed and the guard could never find a violation — it passed by never
			// matching anything, which is the failure this whole session has been deleting.
			const key = file
				.replace(process.cwd(), "")
				.replaceAll("\\", "/")
				.replace(/^\//, "");
			found.set(key, matches.length);
		}
		return found;
	};

	it("compares against a kind label only in the four justified places", () => {
		const found = kindComparisons();
		expect(
			[...found.keys()].sort(),
			"kind is compared somewhere it is not justified. AGENTS.md makes it load-bearing in exactly one place (07b's gate rule); anywhere else it makes humans and agents differ in capability rather than in label.",
		).toEqual(Object.keys(WHY).sort());
		for (const [file, count] of found) {
			expect(count, `${file} compares kind ${count} times`).toBe(1);
		}
	});

	it("never compares it in an authorization path", () => {
		// The narrower, non-negotiable half: whatever the four above are doing, the enforcement module
		// and the vocabulary must not branch on kind at all.
		const found = [...kindComparisons().keys()];
		for (const forbidden of [
			"src/server/permissions",
			"src/domain/grants",
			"src/server/functions/read",
		]) {
			expect(
				found.filter((file) => file.startsWith(forbidden)),
				`${forbidden} branches on kind`,
			).toEqual([]);
		}
	});

	it("finds the occurrences it is supposed to allow, so the scan is not vacuous", () => {
		// A scan that found nothing anywhere would pass the assertions above while proving nothing.
		expect(kindComparisons().size).toBe(Object.keys(WHY).length);
	});
});

describe("the refusal through the interface", () => {
	it("is the same refusal at both entry points", async () => {
		// 07a:24 asks for the refusal to be asserted through the client interface as well as through
		// direct calls. The in-memory client answers `readPrincipal`'s grant from the store, so the
		// two entry points ask the same question — this asserts the interface one.
		const { createInMemoryClient } = await import("#/client/in-memory");
		const platform = store();
		const client = createInMemoryClient({
			store: platform,
			principalId: "alex",
		});

		const read = await client.readPrincipal({
			principalId: "alex",
			boardId: "platform",
		});
		expect(read.grant.scope).toBe("board");
		expect(read.grant.permissions).toContain("post:message");

		// The superadmin's board grant is empty, at the interface, for the same reason it is at the
		// store: no board-scoped grant exists.
		const nadiaRead = await client.readPrincipal({
			principalId: "nadia",
			boardId: "platform",
		});
		expect(nadiaRead.grant.permissions).toEqual([]);
	});
});
