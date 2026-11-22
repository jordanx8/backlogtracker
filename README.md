# Backlog Tracker

A personal video game backlog tracker built with React and Vite. Keep track of what you own, what you're playing, and what you've finished, with a journal for each game and stats about your collection.

## Features

- **Game library** – add, edit, and remove games with status, system, genre, franchise, and ownership info
- **Filtering and sorting** – filter by status, system, genre, franchise, ownership, or text search
- **Metadata lookup** – optional IGDB integration auto-fills cover art, game details, and main-story time to beat
- **Included games** – track individual games inside collections/bundles with a done checkbox
- **Journal** – per-game notes, plus a combined journal view across all games
- **Stats page** – overview of your collection
- **Random picker** – can't decide what to play next? Let the app choose
- **CSV import** – bulk-import an existing library from a CSV file
- **Stored in GitHub** – the library is JSON in this repo, loaded and autosaved through the GitHub API, so every change is a commit
- **Use it anywhere** – hosted on GitHub Pages, editable from any device, with changes from different devices merged automatically

## Tech Stack

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/) (with `@vitejs/plugin-react`)
- [oxlint](https://oxc.rs/docs/guide/usage/linter) for linting, `node --test` for unit tests
- No app server – data is read and written with the GitHub API; IGDB lookups go through a tiny [Deno Deploy](https://deno.com/deploy) function in [`proxy/`](proxy/)

## Who Can See and Change It

- **Changing the library** requires a GitHub token that can write to this repository. You sign in by pasting one; it is stored only on that device. Nobody else can save changes.
- **Viewing the site** without a token shows only the sign-in screen.
- **The data itself is public**: this is a public repository, so anyone can read `data/games.json` and `data/journal.json` on GitHub. The sign-in screen keeps casual visitors to the site out; it does not make the data secret.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or newer, and npm
- A GitHub fine-grained token for this repository (the app's sign-in screen explains how to create one): **Only select repositories → this repo**, **Repository permissions → Contents: Read and write**

### Install and configure

```bash
npm install
```

Create `.env.local` (see [`.env.example`](.env.example)). None of these values are secret:

```env
VITE_GITHUB_OWNER=your-github-username
VITE_GITHUB_REPO=backlogtracker
VITE_GITHUB_BRANCH=main
VITE_IGDB_PROXY_URL=https://your-proxy.deno.dev
```

Leave `VITE_IGDB_PROXY_URL` empty to run without IGDB lookups; you then enter game details by hand.

> Never put the IGDB client secret in a `VITE_*` variable: Vite copies those into the published JavaScript. The secret belongs only in the proxy's environment (see [`proxy/README.md`](proxy/README.md)).

### Run the app

```bash
npm run dev
```

Open the URL printed in the terminal (usually http://localhost:5173) and sign in with your token. Local development uses the real repository, so edits you make locally are committed too.

## Available Scripts

| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                     |
| `npm run build`   | Create a production build in `dist/`          |
| `npm run preview` | Serve the production build locally            |
| `npm run lint`    | Lint the source with oxlint                   |
| `npm test`        | Run the unit tests (sync, merge, GitHub client, proxy) |

## Deploying

### 1. IGDB proxy (Deno Deploy)

Follow [`proxy/README.md`](proxy/README.md): create a Deno Deploy project from this repo with entrypoint `proxy/main.ts`, and set `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `GITHUB_OWNER`, `GITHUB_REPO` and `ALLOWED_ORIGIN` (your Pages origin, e.g. `https://your-github-username.github.io`).

### 2. GitHub Pages

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add `VITE_IGDB_PROXY_URL` (the Deno Deploy URL). `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO` and `VITE_GITHUB_BRANCH` default to this repository and `main`; add them only to override.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand). The site is published at `https://<owner>.github.io/backlogtracker/`.

The workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) runs the tests, builds and deploys. It skips commits that only touch `data/`, so autosaves don't trigger deploys.

## How Data Is Stored

Your library lives in two JSON files in this repository:

- `data/games.json`
- `data/journal.json`

They are not part of the website build. The app reads and writes them with the GitHub API:

1. **On open** – the app shows what this device has cached, then loads the latest commit on the branch.
2. **On every change** – the change is kept on the device straight away. About 5 seconds after you stop editing, all pending changes are saved as **one commit** with a message like `Update library: edit Pragmata (status); add Hades`. The header shows Saved, Saving…, Unsaved changes, Offline or Save failed.
3. **When you leave** the tab, the app tries to save immediately. Anything not saved stays on the device and is saved next time.
4. **When you come back** to the tab, the app checks for commits made from other devices and brings them in.

### Editing from several devices

Each device remembers the version it last loaded. If another device saved in the meantime, the save is rejected and the app merges both sets of changes, then saves again:

- Different games, or different fields of the same game, are combined.
- If both devices changed the **same field** of the same game, the device saving later wins. The other value is still in the git history.
- A game deleted on one device but edited on the other is kept.
- Journal entries added on either device are all kept.

### Upgrading from the old Save button

If a device still has unsaved changes from the previous version (which saved through the dev server or by downloading files), they are merged and committed the first time the new version opens there.

## Project Structure

```
src/
├── Root.jsx             # Sign-in gate
├── App.jsx              # App shell, state, and routing between tabs
├── config.js            # Build-time settings (VITE_* variables)
├── main.jsx             # Entry point
├── api/
│   ├── auth.js          # Token storage on this device
│   ├── github.js        # GitHub API client (read files, atomic commits)
│   ├── igdb.js          # IGDB lookups through the proxy
│   └── storage.js       # Wires the sync engine to the repository
├── sync/
│   ├── engine.js        # Load, autosave, conflict handling
│   ├── merge.js         # Three-way merge of games and journal
│   └── summary.js       # Commit messages
└── components/
    ├── SignIn.jsx
    ├── SaveStatus.jsx
    ├── HomePage.jsx
    ├── GameCard.jsx
    ├── AddGameModal.jsx
    ├── FilterBar.jsx
    ├── GameJournal.jsx
    ├── AllJournal.jsx
    ├── StatsPage.jsx
    ├── RandomPicker.jsx
    ├── ImportModal.jsx  # CSV import
    └── Icon.jsx
data/
├── games.json
└── journal.json
proxy/                   # IGDB proxy for Deno Deploy
.github/workflows/
└── deploy.yml           # GitHub Pages deploy
```
