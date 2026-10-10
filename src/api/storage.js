/**
 * File-based persistence helpers.
 *
 * Data lives in two JSON files committed to the repo:
 *   public/data/games.json
 *   public/data/journal.json
 *
 * Flow:
 *  - On startup: if dirty flag is set, load from localStorage (unsaved changes).
 *                Otherwise fetch from the repo files (source of truth).
 *  - On every mutation: write to localStorage + set dirty flag.
 *  - On Save: download both JSON files, clear dirty flag.
 *    Drop the files into public/data/ and commit to persist to the repo.
 *
 * Migration: if the repo files are empty but localStorage has data (user was on
 * the old localStorage-only version), treat that as dirty so nothing is lost.
 */

const LS_GAMES   = 'backlog_games'
const LS_JOURNAL = 'backlog_journal'
const LS_DIRTY   = 'backlog_dirty'

function lsRead(key, fallback) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

// ── Write-through cache ───────────────────────────────────────────────────────

export function lsSave(games, journal) {
  localStorage.setItem(LS_GAMES,   JSON.stringify(games))
  localStorage.setItem(LS_JOURNAL, JSON.stringify(journal))
  localStorage.setItem(LS_DIRTY,   'true')
}

// ── Load on startup ───────────────────────────────────────────────────────────

export async function loadData() {
  const dirty = localStorage.getItem(LS_DIRTY) === 'true'

  if (dirty) {
    // Unsaved local changes take priority
    return {
      games:   lsRead(LS_GAMES,   []),
      journal: lsRead(LS_JOURNAL, {}),
      source:  'local',
    }
  }

  // Fetch from repo files
  try {
    const [gRes, jRes] = await Promise.all([
      fetch(`/data/games.json?v=${Date.now()}`),
      fetch(`/data/journal.json?v=${Date.now()}`),
    ])
    if (!gRes.ok || !jRes.ok) throw new Error('fetch failed')

    const games   = await gRes.json()
    const journal = await jRes.json()

    // Migration: repo files are still empty but localStorage has pre-existing data
    // (user was on the old localStorage-only version before file storage was added).
    if (games.length === 0) {
      const lsGames = lsRead(LS_GAMES, null)
      if (lsGames && lsGames.length > 0) {
        localStorage.setItem(LS_DIRTY, 'true')
        return {
          games:   lsGames,
          journal: lsRead(LS_JOURNAL, {}),
          source:  'migrated',
        }
      }
    }

    // Seed localStorage for instant refreshes
    localStorage.setItem(LS_GAMES,   JSON.stringify(games))
    localStorage.setItem(LS_JOURNAL, JSON.stringify(journal))

    return { games, journal, source: 'file' }
  } catch {
    // Network/parse failure — fall back to localStorage
    const lsGames = lsRead(LS_GAMES, [])
    if (lsGames.length > 0) {
      localStorage.setItem(LS_DIRTY, 'true')
    }
    return {
      games:   lsGames,
      journal: lsRead(LS_JOURNAL, {}),
      source:  'local',
    }
  }
}

// ── Save to disk (dev) / download (prod) ─────────────────────────────────────

export async function exportData(games, journal) {
  try {
    const res = await fetch('/save-data', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ games, journal }),
    })
    if (!res.ok) throw new Error('save failed')
    localStorage.removeItem(LS_DIRTY)
    return { ok: true }
  } catch {
    // Not running in dev (no plugin) — fall back to file downloads
    downloadJSON('games.json',   games)
    downloadJSON('journal.json', journal)
    localStorage.removeItem(LS_DIRTY)
    return { ok: false, downloaded: true }
  }
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function isDirty() {
  return localStorage.getItem(LS_DIRTY) === 'true'
}
