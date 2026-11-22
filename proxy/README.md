# IGDB proxy

A small [Deno Deploy](https://deno.com/deploy) function that lets the hosted app use IGDB without putting the IGDB credentials in the website.

- It holds the IGDB (Twitch) **Client ID and Client Secret** as environment variables.
- It only answers requests carrying a **GitHub token that can write to this repository**, the same token you sign in to the app with. Successful checks are cached for 10 minutes.
- It only forwards the IGDB endpoints the app uses: `games`, `game_time_to_beats`, `screenshots`.
- Browsers can only call it from the Pages site (`ALLOWED_ORIGIN`) and from `http://localhost:*`.

Files: [`handler.ts`](handler.ts) (all logic), [`main.ts`](main.ts) (Deno entry point), [`handler.test.ts`](handler.test.ts) (tests, run with `npm test` from the repo root).

## Environment variables

| Name                 | Example                       | Notes |
| -------------------- | ----------------------------- | ----- |
| `IGDB_CLIENT_ID`     | `abc123…`                     | From your app in the [Twitch Developer Console](https://dev.twitch.tv/console) |
| `IGDB_CLIENT_SECRET` | `xyz789…`                     | Same place. Keep this secret: only set it here |
| `GITHUB_OWNER`       | `jordanx8`                    | Owner of the data repository |
| `GITHUB_REPO`        | `backlogtracker`              | The data repository |
| `ALLOWED_ORIGIN`     | `https://jordanx8.github.io`  | The Pages origin (no path). Comma-separate several if needed |

## Deploy on Deno Deploy

1. Sign in at [dash.deno.com](https://dash.deno.com) with your GitHub account.
2. Create a new project and link it to this repository. Set the **entrypoint** to `proxy/main.ts`, with no build step.
3. In the project's **Settings → Environment Variables**, add the five variables above.
4. Deploy, then open the project URL. It should answer `ok`.
5. Copy the project URL (e.g. `https://backlogtracker-igdb.deno.dev`) into the `VITE_IGDB_PROXY_URL` repository variable (and into `.env.local` for local dev).

Deno Deploy redeploys automatically when `proxy/` changes on `main`.

## Run locally

Install [Deno](https://docs.deno.com/runtime/getting_started/installation/), then from the repo root:

```bash
IGDB_CLIENT_ID=… IGDB_CLIENT_SECRET=… GITHUB_OWNER=jordanx8 GITHUB_REPO=backlogtracker \
  deno run --allow-net --allow-env proxy/main.ts
```

It listens on `http://localhost:8000`. Set `VITE_IGDB_PROXY_URL=http://localhost:8000` in `.env.local` and restart `npm run dev`.
