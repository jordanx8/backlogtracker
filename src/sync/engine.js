/**
 * Sync engine: keeps the library in step with the GitHub repository.
 *
 * Per-device state (persisted in localStorage):
 *   baseSha  – commit this device last loaded or saved
 *   base     – library content at baseSha (the merge base)
 *   local    – library content on this device now
 *   dirty    – local has edits not yet committed
 *
 * Edits are autosaved after a quiet period. A save commits on top of baseSha;
 * if another device has pushed, the commit is rejected, we three-way merge
 * base/local/remote and try again.
 */

import { GitHubError } from '../api/github.js'
import { mergeLibrary } from './merge.js'
import { summarizeChanges } from './summary.js'

export const STATE_KEY = 'backlog_sync_v2'
// Keys used by the previous localStorage + Save-button flow
export const LEGACY_KEYS = { games: 'backlog_games', journal: 'backlog_journal', dirty: 'backlog_dirty' }

const MAX_MERGE_RETRIES = 3
const RETRY_MS          = 30_000

export const serialize = (data) => JSON.stringify(data, null, 2)

function parseFile(text, fallback) {
  if (text == null || text.trim() === '') return fallback
  return JSON.parse(text)
}

/**
 * @param {object} opts
 * @param {ReturnType<import('../api/github.js').createGitHubClient>} opts.client
 * @param {Storage} opts.storage                  localStorage-like
 * @param {{ games: string, journal: string }} opts.paths   repo paths of the data files
 * @param {number} [opts.debounceMs]
 * @param {(event: { status: string, error?: string, library?: object }) => void} [opts.onChange]
 * @param {typeof setTimeout} [opts.setTimer]
 * @param {typeof clearTimeout} [opts.clearTimer]
 */
export function createSyncEngine({
  client,
  storage,
  paths,
  debounceMs = 5000,
  onChange = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
}) {
  let state    = readState()       // { baseSha, base, local, dirty } | null
  let status   = state?.dirty ? 'unsaved' : 'saved'
  let error    = undefined
  let timer    = null
  let saving   = null              // Promise while a save is running
  let revision = 0                 // bumps on every local edit

  // ── persistence ──────────────────────────────────────────────────────────────

  function readState() {
    try {
      const raw = storage.getItem(STATE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function writeState() {
    try {
      storage.setItem(STATE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('[sync] could not persist local state', e)
    }
  }

  function readLegacy() {
    try {
      if (storage.getItem(LEGACY_KEYS.dirty) !== 'true') return null
      return {
        games:   JSON.parse(storage.getItem(LEGACY_KEYS.games)   ?? '[]'),
        journal: JSON.parse(storage.getItem(LEGACY_KEYS.journal) ?? '{}'),
      }
    } catch {
      return null
    }
  }

  function clearLegacy() {
    for (const k of Object.values(LEGACY_KEYS)) storage.removeItem(k)
  }

  // ── status ───────────────────────────────────────────────────────────────────

  function setStatus(next, err) {
    status = next
    error  = err
    onChange({ status, error })
  }

  function emitLibrary() {
    onChange({ status, error, library: state.local })
  }

  // ── remote ───────────────────────────────────────────────────────────────────

  async function fetchRemote(sha) {
    const files = await client.readFiles(sha, [paths.games, paths.journal])
    return {
      games:   parseFile(files[paths.games],   []),
      journal: parseFile(files[paths.journal], {}),
    }
  }

  /** Bring `remote` (at `sha`) in under any local edits. Returns true if local changed. */
  function absorbRemote(sha, remote) {
    if (state?.dirty) {
      const merged = mergeLibrary(state.base, state.local, remote)
      state = { baseSha: sha, base: remote, local: merged, dirty: true }
    } else {
      state = { baseSha: sha, base: remote, local: remote, dirty: false }
    }
    writeState()
  }

  function handleFailure(e) {
    if (e instanceof GitHubError && e.kind === 'unauthorized') {
      setStatus('unauthorized', 'GitHub rejected the token')
      return
    }
    const offline = e instanceof GitHubError && e.kind === 'network'
    setStatus(offline ? 'offline' : 'error', e.message)
    if (state?.dirty) schedule(RETRY_MS)
  }

  // ── save ─────────────────────────────────────────────────────────────────────

  function schedule(ms = debounceMs) {
    if (timer) clearTimer(timer)
    timer = setTimer(() => { timer = null; return save() }, ms)
  }

  async function doSave() {
    for (let attempt = 0; attempt <= MAX_MERGE_RETRIES; attempt++) {
      const startRevision = revision
      const snapshot      = state.local
      const message       = summarizeChanges(state.base, snapshot)
      try {
        const sha = await client.commitFiles({
          parentSha: state.baseSha,
          files: {
            [paths.games]:   serialize(snapshot.games),
            [paths.journal]: serialize(snapshot.journal),
          },
          message,
        })
        const editedMeanwhile = revision !== startRevision
        state = { baseSha: sha, base: snapshot, local: state.local, dirty: editedMeanwhile }
        writeState()
        if (editedMeanwhile) { setStatus('unsaved'); schedule() }
        else setStatus('saved')
        return
      } catch (e) {
        if (!(e instanceof GitHubError && e.kind === 'conflict')) throw e
        // Another device saved first: merge with the new head and try again
        const head   = await client.getHeadSha()
        const remote = await fetchRemote(head)
        absorbRemote(head, remote)
        emitLibrary()
      }
    }
    throw new GitHubError('Kept conflicting with another device; will retry', 'http')
  }

  async function save() {
    if (timer) { clearTimer(timer); timer = null }
    if (saving) { await saving; if (state?.dirty) return save(); return }
    if (!state?.dirty) return
    setStatus('saving')
    saving = doSave().catch(handleFailure).finally(() => { saving = null })
    return saving
  }

  // ── public API ───────────────────────────────────────────────────────────────

  return {
    /** Library cached on this device, for an instant first paint (or null). */
    cached() {
      return state?.local ?? null
    },

    status() {
      return { status, error }
    },

    isDirty() {
      return Boolean(state?.dirty)
    },

    /**
     * Load from the branch head, merging any local edits (including edits left
     * by the previous version of the app). Resolves to the library to show.
     */
    async load() {
      const legacy = readLegacy()
      let head
      try {
        head = await client.getHeadSha()
      } catch (e) {
        if (state && !(e instanceof GitHubError && e.kind === 'unauthorized')) {
          handleFailure(e)
          return state.local
        }
        throw e
      }

      if (legacy) {
        // Old unsaved edits: treat them as local against the current head
        const remote = await fetchRemote(head)
        state = { baseSha: head, base: remote, local: legacy, dirty: true }
        writeState()
        clearLegacy()
      } else if (!state || state.baseSha !== head) {
        const remote = await fetchRemote(head)
        absorbRemote(head, remote)
        clearLegacy()
      }

      if (state.dirty) { setStatus('unsaved'); schedule(0) }
      else setStatus('saved')
      return state.local
    },

    /** Record a local edit. Pass the same objects back to make this a no-op. */
    update(library) {
      if (!state) return
      if (library.games === state.local.games && library.journal === state.local.journal) return
      revision++
      state = { ...state, local: { games: library.games, journal: library.journal }, dirty: true }
      writeState()
      if (status !== 'saving') setStatus('unsaved')
      schedule()
    },

    /** Save now (e.g. when the page is hidden). */
    flush: save,

    /**
     * Check for commits from other devices (e.g. when the tab regains focus).
     * Without local edits the newer library replaces the shown one; with local
     * edits they are merged and saved.
     */
    async refresh() {
      if (!state || saving) return
      try {
        const head = await client.getHeadSha()
        if (head === state.baseSha) {
          if (status === 'offline' || status === 'error') {
            if (state.dirty) save(); else setStatus('saved')
          }
          return
        }
        const remote = await fetchRemote(head)
        absorbRemote(head, remote)
        emitLibrary()
        if (state.dirty) await save()
        else setStatus('saved')
      } catch (e) {
        handleFailure(e)
      }
    },

    /** Stop timers (on sign-out / unmount). */
    stop() {
      if (timer) clearTimer(timer)
      timer = null
    },

    /** Remove everything this engine stored on the device. */
    clear() {
      this.stop()
      storage.removeItem(STATE_KEY)
      clearLegacy()
      state = null
    },
  }
}
