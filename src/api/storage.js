/**
 * Library persistence: the games and journal live in the GitHub repository
 * (data/games.json, data/journal.json) and are loaded and autosaved through
 * the GitHub API. See src/sync/engine.js for the sync and merge behaviour.
 */

import { config } from '../config'
import { createGitHubClient } from './github'
import { createSyncEngine } from '../sync/engine'

export const DATA_PATHS = {
  games:   `${config.dataDir}/games.json`,
  journal: `${config.dataDir}/journal.json`,
}

export function githubClient(token) {
  return createGitHubClient({ token, owner: config.owner, repo: config.repo, branch: config.branch })
}

/** Create the sync engine for a signed-in token. */
export function createLibrarySync(token, onChange) {
  return createSyncEngine({
    client:  githubClient(token),
    storage: window.localStorage,
    paths:   DATA_PATHS,
    onChange,
  })
}
