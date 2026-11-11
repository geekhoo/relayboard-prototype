import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import type { RouterContext } from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

/**
 * The router's context is the app's one data seam.
 *
 * Only the type changed in this ticket: 04a's criterion is that the client is provided once
 * per router rather than at module scope, so the client travels on this context beside the
 * Query client, and a component reads it with `useRouteContext` instead of importing a
 * module that builds one. The document shell below is 01's and is untouched.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Relayboard",
			},
			{
				name: "description",
				content:
					"Relayboard — a durable, topic-oriented messaging workspace where humans and independent agents converse asynchronously as peers.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

/**
 * The document shell is the app frame. Relayboard's own surface is the workspace — a
 * full-bleed, three-column grid — so the shell leaves room for no site chrome and no
 * floating panel. DESIGN.md defines one light world, so there is no theme to apply
 * before first paint either.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
