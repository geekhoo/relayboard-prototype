Relayboard — the TanStack Start application.

# Getting Started

To run this application:

```bash
npm install
cp .env.example .env      # then set SESSION_SECRET — see T3Env below
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## The gates, and which one to run when

```bash
npm test        # the Node suite: store, domain, contract, client. No DOM, no network, no build.
npm run e2e     # the route seam: Playwright driving the BUILT app in a real browser.
```

They are deliberately separate commands and neither calls the other. `npm test` is the fast,
hermetic suite that runs on every save; `npm run e2e` downloads a browser, builds and starts a
server, so it belongs in CI and in a developer's deliberate check rather than in every iteration.
The root `npm run app:check` is the fast gate for the same reason and does **not** run e2e.

`npm run e2e` builds first so it works from a clean checkout. In CI the build has already
happened and has already been asserted, so the workflow sets `RELAYBOARD_E2E_REUSE_BUILD=1` and
the harness runs the existing build — failing loudly if there is none, rather than quietly
building a second one nobody asserted.

A failed run leaves `test-results/` and `playwright-report/` (both gitignored) with a trace,
a screenshot and a DOM snapshot; `npx playwright show-trace test-results/<case>/trace.zip`
opens the failing case step by step. CI uploads those files as an artefact instead.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
npm run lint
npm run format
npm run check
```


## T3Env

- You can use T3Env to add type safety to your environment variables.
- Add environment variables to `src/env.ts` — not `src/env.mjs`, which never existed; this
  line named a file the scaffold never generated.
- **`SESSION_SECRET` is required.** Copy `.env.example` to `.env` and generate one with
  `openssl rand -base64 32`, or export it into the process. The server serves nothing
  without it: the resolver reads it at import time, so the first request fails with the
  variable named rather than the app appearing to work until a cookie is needed.
- `runtimeEnv` is the process environment with Vite's build-time snapshot merged under it.
  `import.meta.env` alone cannot see a server-only variable at all — `NOTES.md` §5(d)
  measured `SERVER_URL` coming back `undefined` that way.

### Usage

```ts
import { env } from "#/env";

console.log(env.VITE_APP_TITLE);
```





## Deployment

Not Vercel. The app targets one long-running Node process — the store is in memory and the
stream is a long-lived Server-Sent Events connection — so a serverless, horizontally-scaled
platform is a target it cannot hold. `vite.config.ts` pins Nitro's `node-server` preset so a
build cannot silently become one.

```bash
npm run build
node .output/server/index.mjs
```

Variables prefixed with `VITE_` are included in the browser bundle. Keep secrets
unprefixed so they remain server-only.



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).


# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.


# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).