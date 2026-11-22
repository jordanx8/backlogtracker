# Tasks

## 1. Remove HowLongToBeat

- [x] 1.1 Delete `src/api/hltb.js` and remove the HLTB fallback from `enrichGame` in `src/api/igdb.js`; verify `grep -ri hltb src` finds only CSS class names
- [x] 1.2 Remove the HLTB fallback in `src/components/AddGameModal.jsx` so time to beat comes only from `getTimeToBeat`; verify that picking a game with no IGDB time to beat leaves the field empty and editable, and that `npm run lint` passes
- [x] 1.3 Remove HowLongToBeat from the README feature list and notes; verify the README no longer mentions it

## 2. Configuration and data location

- [x] 2.1 Move `public/data/games.json` and `journal.json` to `data/` (with `git mv`, so history follows); verify `npm run build` output in `dist/` contains no `data/` files
- [x] 2.2 Add a config module that reads `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO`, `VITE_GITHUB_BRANCH` (default `main`) and `VITE_IGDB_PROXY_URL`, and add an `.env.example` listing them; verify the app logs a clear error when owner or repo is missing
- [x] 2.3 Set Vite `base` to `/backlogtracker/` for production builds and `/` in dev; verify built asset URLs in `dist/index.html` start with `/backlogtracker/`
- [x] 2.4 Add a `test` script running `node --test` over `src/**/*.test.js` (no new dependency); verify `npm test` runs and passes with a trivial test

## 3. GitHub client and sign-in

- [x] 3.1 Write a small GitHub API client (`src/api/github.js`): authorized fetch, repo permission check, read head commit, read file at commit, and atomic two-file commit through the Git Data API with non-force ref update that reports a conflict distinctly; verify by unit tests with a stubbed `fetch` covering success, 401, and non-fast-forward
- [x] 3.2 Build the sign-in screen: token input, step-by-step instructions for creating a fine-grained token (this repo only, Contents read/write), and rejection messages for invalid or read-only tokens; verify by signing in with a valid token, a garbage token, and a read-only token
- [x] 3.3 Gate `App.jsx` on a stored, verified token; return to sign-in on 401 while keeping unsaved local edits; add sign-out with an unsaved-edits warning that clears the token and cached data; verify each scenario in `specs/owner-access/spec.md` by hand

## 4. Merge logic

- [x] 4.1 Implement a pure three-way merge for the games array keyed by `id` (add, delete, delete-vs-edit keeps the edit, field-level merge with local winning both-sides conflicts, whole-value comparison for arrays, remote order with local additions appended); verify with unit tests for each rule
- [x] 4.2 Implement the same three-way merge for the journal keyed by game id, then entry `id`; verify with unit tests including entries added on both sides for the same game
- [x] 4.3 Implement the commit-message summary by diffing base against local (added, edited, removed game titles, plus journal changes); verify with unit tests, including truncation when many games change

## 5. Sync engine

- [x] 5.1 Rewrite `src/api/storage.js` around a per-device state in localStorage (base commit sha, base content, local content), loading from the branch head after sign-in; verify that a fresh device shows the latest committed data and that reloads are instant from cache
- [x] 5.2 Add debounced autosave (5 seconds) using the atomic commit, merging and retrying up to three times on conflict; verify that a burst of edits produces one commit on GitHub, and that two browser profiles editing different games both land
- [x] 5.3 Add save-on-hide and a head check on focus (silent reload when there are no local edits, merge when there are); verify by editing in one profile, switching to the other, and seeing the change appear
- [x] 5.4 Replace the Save button with a status indicator (Saved, Saving, Unsaved, Offline, Error) and retry after failures; verify each state, using the browser's offline mode for Offline
- [x] 5.5 Migrate old unsaved edits: if the old `backlog_dirty` flag is set, treat old localStorage content as local against the loaded head, save through the merge, then remove the old keys; verify by seeding the old keys and confirming the edits are committed
- [x] 5.6 Remove the `save-data` plugin from `vite.config.js`; verify `npm run dev` starts and loading and saving work against GitHub
- [x] 5.7 Rewrite the README storage section (data in `data/`, autosave commits, multi-device merge, public-data caveat); verify it matches the behaviour

## 6. IGDB proxy

- [x] 6.1 Create `proxy/main.ts` for Deno Deploy: CORS allowlist from `ALLOWED_ORIGIN` plus localhost, GitHub token push-access check cached for 10 minutes, cached Twitch app token, and forwarding of an endpoint allowlist (`games`, `game_time_to_beats`, `screenshots`); verify with `deno test` covering missing token, read-only token, disallowed endpoint, and success with a stubbed upstream
- [x] 6.2 Point `src/api/igdb.js` at `VITE_IGDB_PROXY_URL` with the GitHub token, drop the client ID and secret from the frontend, and enable IGDB features based on the proxy URL; verify the built bundle contains no `IGDB_CLIENT_SECRET` value (`grep` over `dist/`)
- [x] 6.3 Show a clear "lookup unavailable" state in the add-game form when the proxy fails or is not configured; verify by pointing the proxy URL at a dead address
- [ ] 6.4 Remove the `/twitch-token` and `/igdb-api` dev proxies from `vite.config.js`, and document running the proxy locally with `deno run`; verify search works in `npm run dev` against a local proxy
- [ ] 6.5 Add a README section for deploying the proxy (create the Deno Deploy project from `proxy/`, set `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `GITHUB_OWNER`, `GITHUB_REPO`, `ALLOWED_ORIGIN`); verify by following it to a working deployment

## 7. Pages deployment

- [ ] 7.1 Add `.github/workflows/deploy.yml` that builds with the `VITE_*` repository variables and deploys with `actions/deploy-pages`, ignoring `data/**` and `openspec/**`; verify that a code push deploys and an autosave commit does not
- [ ] 7.2 Document the Pages setup in the README (Pages source set to GitHub Actions, repository variables to add); verify the site loads at the Pages URL

## 8. End-to-end checks

- [ ] 8.1 On the deployed site, run through sign-in, add a game with IGDB auto-fill, edit, journal entry, and sign-out; verify each step and the resulting commits on GitHub
- [ ] 8.2 With two devices or browser profiles, run the merge scenarios in `specs/library-sync/spec.md` (different games, same game different fields, same field, delete vs edit); verify the final `data/` files match the expected results
- [ ] 8.3 Confirm that a visitor without a token sees only the sign-in screen, and that `/backlogtracker/data/games.json` is not served; verify in a private window

## Workflow follow-up

- Owner setup outside the code: create the fine-grained token, create the Deno Deploy account (sign in with GitHub) and project, set Pages source to GitHub Actions, and add the repository variables.
- Archive the change after implementation and the end-to-end checks are complete.
