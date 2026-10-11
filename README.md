# Backlog Tracker

A personal video game backlog tracker built with React and Vite. Keep track of what you own, what you're playing, and what you've finished, with a journal for each game and stats about your collection.

## Features

- **Game library** – add, edit, and remove games with status, system, genre, franchise, and ownership info
- **Filtering and sorting** – filter by status, system, genre, franchise, ownership, or text search
- **Metadata lookup** – optional IGDB integration auto-fills cover art and game details
- **Play-time estimates** – HowLongToBeat lookup for main-story hours (see note below)
- **Included games** – track individual games inside collections/bundles with a done checkbox
- **Journal** – per-game notes, plus a combined journal view across all games
- **Stats page** – overview of your collection
- **Random picker** – can't decide what to play next? Let the app choose
- **CSV import** – bulk-import an existing library from a CSV file
- **File-based storage** – data is stored as JSON in the repo, so it can be version-controlled

## Tech Stack

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/) (with `@vitejs/plugin-react`)
- [oxlint](https://oxc.rs/docs/guide/usage/linter) for linting
- No backend – a small Vite dev-server plugin handles saving data to disk

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (a current LTS release is recommended) and npm

### Install

```bash
npm install
```

### Configure IGDB (optional)

Game search/auto-fill uses the [IGDB API](https://api-docs.igdb.com/), which requires a free Twitch developer application.

1. Create an application at the [Twitch Developer Console](https://dev.twitch.tv/console) to get a Client ID and Client Secret.
2. Create a `.env.local` file in the project root:

   ```env
   VITE_IGDB_CLIENT_ID=your_client_id
   VITE_IGDB_CLIENT_SECRET=your_client_secret
   ```

If `VITE_IGDB_CLIENT_ID` is not set, the app still works, but IGDB lookup is disabled and you enter game details manually.

> `.env.local` should not be committed. The IGDB and Twitch requests are routed through the Vite dev-server proxy (`/igdb-api`, `/twitch-token`) to avoid CORS issues, so IGDB lookups work in `npm run dev` only.
>
> The HowLongToBeat lookup in [`src/api/hltb.js`](src/api/hltb.js) calls `/hltb-api`, which is not currently configured in the proxy in [`vite.config.js`](vite.config.js), so play-time lookups may not return results until a proxy is added.

### Run the app

```bash
npm run dev
```

Then open the URL printed in the terminal (usually http://localhost:5173).

## Available Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the Vite dev server                |
| `npm run build`   | Create a production build in `dist/`     |
| `npm run preview` | Serve the production build locally       |
| `npm run lint`    | Lint the source with oxlint              |

## How Data Is Stored

Your library lives in two JSON files in the repo:

- `public/data/games.json`
- `public/data/journal.json`

The flow works like this:

1. **On startup** – if there are unsaved local changes, they're loaded from `localStorage`. Otherwise the JSON files are fetched and used as the source of truth.
2. **On every change** – the app writes to `localStorage` and marks the data as "unsaved".
3. **On Save**
   - In **dev** (`npm run dev`), the data is written directly to `public/data/games.json` and `public/data/journal.json` via the `/save-data` endpoint defined in [`vite.config.js`](vite.config.js).
   - In a **production build**, there is no save endpoint, so the app downloads both JSON files instead. Drop them into `public/data/` and commit to persist.

Commit the updated JSON files to keep your backlog in version control.

## Project Structure

```
src/
├── App.jsx              # App shell, state, and routing between tabs
├── main.jsx             # Entry point
├── api/
│   ├── igdb.js          # IGDB / Twitch auth and game lookup
│   ├── hltb.js          # HowLongToBeat lookup
│   └── storage.js       # localStorage + JSON file persistence
└── components/
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
public/
└── data/
    ├── games.json
    └── journal.json
```
