import type { PurgeImpact } from "#/client";
import type { RelayboardClientBound } from "#/client/context";

/**
 * What a purge would remove — **the same predicate the purge uses**, asked as a read.
 *
 * 14:14 requires the confirmation to name the overlap before the act, so this is a read the dialog
 * shows. `staleTime: 0` because the answer changes whenever the reader posts: a stale count would name
 * a number they have already changed.
 */
export const purgeImpactQuery = (client: RelayboardClientBound) => ({
	queryKey: ["purge-impact"] as const,
	queryFn: (): Promise<PurgeImpact> => client.purgeImpact(),
	retry: false,
	staleTime: 0,
});
