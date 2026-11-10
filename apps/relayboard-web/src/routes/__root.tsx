import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
