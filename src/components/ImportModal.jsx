import { useState, useRef } from 'react'
import Icon from './Icon'

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles quoted fields with embedded commas and newlines.
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }       // escaped quote
      else if (ch === '"')            { inQuotes = false }        // closing quote
      else                            { field += ch }
    } else {
      if      (ch === '"')  { inQuotes = true }
      else if (ch === ',')  { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else                  { field += ch }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── Field mapping ─────────────────────────────────────────────────────────────
const PLATFORM_REMAP = {
  'Nintendo GameCube': 'GameCube',
  'Super Nintendo Entertainment System (SNES)': 'Super Nintendo',
  'Nintendo Entertainment System (NES)': 'NES',
  'Xbox Series X|S': 'Xbox Series X/S',
  'Sega Mega Drive/Genesis': 'Sega Genesis',
}
function mapPlatform(p) { return PLATFORM_REMAP[p] ?? p }

function mapStatus(csvStatus, csvCompletion) {
  const s = (csvStatus ?? '').toLowerCase()
  const c = (csvCompletion ?? '').toLowerCase()
  if (s === 'playing')  return 'playing'
  if (c === 'completed' || c === 'beaten') return 'completed'
  if (s === 'played' && (c === 'dropped' || c === 'unfinished')) return 'playing'
  return 'backlog'
}

function mapOwnership(format) {
  const f = (format ?? '').toLowerCase()
  if (f === 'physical') return 'physical'
  if (f === 'digital')  return 'digital'
  return ''
}

// Score is 0–100 in InfiniteBacklog; map to 1–5 stars
function mapRating(score) {
  const n = Number(score)
  if (!n || isNaN(n)) return null
  if (n >= 90) return 5
  if (n >= 70) return 4
  if (n >= 50) return 3
  if (n >= 30) return 2
  return 1
}

function releaseYear(dateStr) {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})/)
  return m ? m[1] : ''
}

// ── Core parse logic ──────────────────────────────────────────────────────────
export function parseInfiniteBacklogCSV(text) {
  const rows = parseCSV(text.trim())
  if (rows.length < 2) return []

  const header = rows[0].map(h => h.trim())
  const col = name => header.indexOf(name)

  const C = {
    igdbId:      col('IGDB ID'),
    name:        col('Game name'),
    released:    col('Game release date'),
    platform:    col('Platform'),
    type:        col('Type'),
    status:      col('Status'),
    completion:  col('Completion'),
    ownership:   col('Ownership'),
    format:      col('Format'),
    notes:       col('Progress notes'),
    score:       col('Rating (Score)'),
  }

  const games = []
  let currentGame = null

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every(f => !f.trim())) continue  // blank row

    const type       = row[C.type]?.trim() ?? ''
    const igdbId     = row[C.igdbId]?.trim() ?? ''
    const title      = row[C.name]?.trim() ?? ''
    const platform   = mapPlatform(row[C.platform]?.trim() ?? '')
    const status     = mapStatus(row[C.status], row[C.completion])
    const completion = row[C.completion]?.trim() ?? ''
    const ownership  = mapOwnership(row[C.format])
    const released   = releaseYear(row[C.released])
    const notes      = row[C.notes]?.trim() ?? ''
    const rating     = mapRating(row[C.score])

    if (type === 'DLC / Expansion') continue  // skip DLCs entirely

    if (type === 'Bundled Game') {
      // Attach as includedGame to the most recent main game
      if (currentGame) {
        const done = completion.toLowerCase() === 'beaten' || completion.toLowerCase() === 'completed'
        currentGame.includedGames = currentGame.includedGames ?? []
        currentGame.includedGames.push({ title, done, igdbId: igdbId ? Number(igdbId) : undefined })
      }
      continue
    }

    // Main game row
    currentGame = {
      igdbId:    igdbId ? Number(igdbId) : undefined,
      title,
      system:    platform,
      status,
      ownership,
      released,
      notes,
      rating,
      genre:     '',
      franchise: '',
      cover:     '',
      timeToBeat: null,
      tags:      [],
    }
    games.push(currentGame)
  }

  return games
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportModal({ existingGames, onImport, onClose }) {
  const fileRef  = useRef(null)
  const [parsed,   setParsed]   = useState(null)   // { toImport, skipped }
  const [parseErr, setParseErr] = useState('')
  const [done,     setDone]     = useState(false)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseErr('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const all = parseInfiniteBacklogCSV(ev.target.result)
        if (!all.length) { setParseErr('No games found in file.'); return }

        // Deduplicate: skip if IGDB ID matches OR title+system match (case-insensitive)
        const existingIgdbIds = new Set(
          existingGames.map(g => g.igdbId).filter(Boolean)
        )
        const existingKeys = new Set(
          existingGames.map(g => `${g.title.toLowerCase()}|${g.system.toLowerCase()}`)
        )

        const toImport = []
        const skipped  = []
        for (const g of all) {
          const key = `${g.title.toLowerCase()}|${g.system.toLowerCase()}`
          if ((g.igdbId && existingIgdbIds.has(g.igdbId)) || existingKeys.has(key)) {
            skipped.push(g)
          } else {
            toImport.push(g)
          }
        }
        setParsed({ toImport, skipped })
      } catch (err) {
        setParseErr(`Parse error: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    onImport(parsed.toImport)
    setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--import">
        <div className="modal-header">
          <h2>Import from InfiniteBacklog CSV</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <div className="import-body">
          {done ? (
            <div className="import-done">
              <span className="import-done-icon"><Icon name="check" size={20} /></span>
              <p>Imported {parsed.toImport.length} game{parsed.toImport.length !== 1 ? 's' : ''}!</p>
              <p className="import-done-sub">
                Head to the Collection tab to see them.
                {parsed.skipped.length > 0 && ` ${parsed.skipped.length} duplicate${parsed.skipped.length !== 1 ? 's were' : ' was'} skipped.`}
              </p>
              <button className="btn-primary" onClick={onClose}>Close</button>
            </div>
          ) : !parsed ? (
            <>
              <p className="import-hint">
                Export your collection from <strong>InfiniteBacklog</strong> as a CSV and select the file below.
                Games already in your collection (matched by IGDB ID or title + platform) will be skipped.
              </p>
              <label className="import-file-label">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="import-file-input"
                  onChange={handleFile}
                />
                <span className="import-file-btn"><Icon name="folder" size={14} /> Choose CSV file</span>
              </label>
              {parseErr && <p className="field-error">{parseErr}</p>}
            </>
          ) : (
            <>
              <div className="import-summary">
                <div className="import-summary-pill import-summary-pill--new">
                  {parsed.toImport.length} to import
                </div>
                <div className="import-summary-pill import-summary-pill--skip">
                  {parsed.skipped.length} already in collection
                </div>
              </div>

              {parsed.toImport.length === 0 ? (
                <p className="import-hint">All games in the CSV are already in your collection.</p>
              ) : (
                <div className="import-preview">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Ownership</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.toImport.map((g, i) => (
                        <tr key={i}>
                          <td>
                            {g.title}
                            {g.includedGames?.length > 0 && (
                              <span className="import-bundle-badge">
                                +{g.includedGames.length} inside
                              </span>
                            )}
                          </td>
                          <td>{g.system || <span className="import-na">—</span>}</td>
                          <td>
                            <span className={`status-badge status-badge--${g.status}`}>
                              {{ backlog: 'Not Started', playing: 'Playing', completed: 'Completed', shelved: 'Shelved' }[g.status] ?? g.status}
                            </span>
                          </td>
                          <td>{g.ownership || <span className="import-na">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setParsed(null)}>← Back</button>
                {parsed.toImport.length > 0 && (
                  <button className="btn-primary" onClick={handleImport}>
                    Import {parsed.toImport.length} game{parsed.toImport.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
