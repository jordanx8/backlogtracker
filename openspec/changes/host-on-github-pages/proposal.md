# Proposal

## Why

The tracker can only save while the Vite dev server runs on one machine: saves go through a dev-only plugin, and IGDB lookups go through dev-only proxies. Moving it to GitHub Pages lets the owner use and edit it from any device, but a static host has no server, so storage, sign-in, and lookups each need a new home that only the owner can write to.

## What Changes

- Host the built app on GitHub Pages (served under the `/backlogtracker/` subpath), deployed by a GitHub Actions workflow.
- Add a sign-in screen: the owner pastes a fine-grained GitHub token scoped to this repository. The app checks that the token has push access before showing any data. Without a valid token the app shows only the sign-in screen. The data remains readable in the public repository, so this gate is privacy from casual visitors, not secrecy.
- **BREAKING**: Load `games.json` and `journal.json` through the GitHub Contents API with the token, instead of fetching them from the site.
- **BREAKING**: Replace the manual Save button and dev-server save with autosave: edits are batched and committed to the repository through the Contents API a few seconds after the last change.
- Support editing from multiple devices. Each device keeps the version it last loaded as a merge base. When a save is rejected because another device saved first, the app three-way merges by game id and journal entry id and retries. The app checks for remote changes when the tab regains focus.
- Route IGDB lookups through a small Deno Deploy function that holds the IGDB client secret and accepts only requests carrying a GitHub token with push access to this repository. The IGDB secret is no longer compiled into the frontend bundle.
- **BREAKING**: Remove the HowLongToBeat lookup from the app. The `timeToBeat` field stays and is still filled from IGDB when available, or entered by hand.

## Capabilities

### New Capabilities
- `owner-access`: Signing in with a GitHub token, verifying it grants push access, gating the UI, and signing out.
- `library-sync`: Loading library data from the GitHub repository, autosaving changes as commits, and reconciling concurrent edits from multiple devices.
- `game-metadata-lookup`: Searching IGDB and auto-filling game details through an owner-only proxy; covers the removal of HowLongToBeat lookups.

### Modified Capabilities
<!-- None: no specs exist yet in openspec/specs/. -->

## Impact

- **Code**: `src/api/storage.js` (rewritten around the Contents API), `src/App.jsx` (sign-in gate, autosave status replacing the Save button), `src/api/igdb.js` (calls the proxy, no client secret), `src/components/AddGameModal.jsx` (HLTB fallback removed), `src/api/hltb.js` (deleted), `vite.config.js` (`base` path; the save plugin and proxies stay only as needed for local dev).
- **New code**: a Deno Deploy function (IGDB proxy with GitHub token check) and a GitHub Actions workflow for Pages deploys.
- **External services**: GitHub Contents API, GitHub Pages, Deno Deploy (new account, signed in with GitHub), IGDB/Twitch.
- **Configuration**: the IGDB client ID and secret move from `.env.local` to Deno Deploy environment variables. The frontend needs only the proxy URL and the repository owner/name.
- **Owner setup** (manual): create the fine-grained token, enable Pages, create the Deno Deploy project and its secrets.
- **Data**: the JSON file format is unchanged. Unsaved edits left in a device's localStorage from the old flow must be carried into the new one.
- **Docs**: README setup and storage sections need rewriting.
