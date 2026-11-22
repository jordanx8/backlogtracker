import { useState } from 'react'
import Icon from './Icon'
import { SYSTEMS, GENRES } from '../constants'
import { config } from '../config'

const EMPTY = { title: '', system: '', genre: '', status: 'backlog', ownership: '', franchise: '', timeToBeat: '', rating: '', notes: '', cover: '', released: '', includedGames: '', developer: '', criticScore: null, gameModes: [], perspectives: [], dlc: '' }

// IGDB lookups run in GitHub Actions, not in the app (see scripts/add-game.js)
const ADD_FROM_IGDB_URL = `https://github.com/${config.owner}/${config.repo}/actions/workflows/add-game.yml`

function formFromGame(game) {
  if (!game) return EMPTY
  return {
    title:         game.title,
    system:        SYSTEMS.includes(game.system) ? game.system : 'Other',
    genre:         game.genre || '',
    status:        game.status,
    ownership:     game.ownership || '',
    franchise:     game.franchise || '',
    timeToBeat:    game.timeToBeat ?? '',
    rating:        game.rating ?? '',
    notes:         game.notes || '',
    cover:         game.cover || '',
    released:      game.released || '',
    developer:     game.developer || '',
    criticScore:   game.criticScore ?? null,
    gameModes:     game.gameModes ?? [],
    perspectives:  game.perspectives ?? [],
    // Support both old string[] and new {title,done}[] formats
    includedGames: (game.includedGames ?? [])
      .map(g => (typeof g === 'string' ? g : g.title))
      .join('\n'),
    dlc: (game.dlc ?? []).map(d => d.title).join('\n'),
  }
}

export default function AddGameModal({ game, onSave, onClose, existingSystems }) {
  // The modal is mounted fresh for each add/edit, so initial state comes from `game`
  const [form, setForm] = useState(() => formFromGame(game))
  const [customSystem, setCustomSystem] = useState(() => (game && !SYSTEMS.includes(game.system) ? game.system : ''))
  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    const resolvedSystem = form.system === 'Other' ? customSystem.trim() : form.system
    if (!resolvedSystem) e.system = 'System is required'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const resolvedSystem = form.system === 'Other' ? customSystem.trim() : form.system

    // Build new includedGames, preserving existing status/done state where titles match
    const existingIncludedMap = Object.fromEntries(
      (game?.includedGames ?? []).map(g =>
        typeof g === 'string'
          ? [g, { status: 'backlog', done: false }]
          : [g.title, { status: g.status ?? (g.done ? 'completed' : 'backlog'), done: g.done ?? false }]
      )
    )
    const includedGames = form.includedGames
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => {
        const existing = existingIncludedMap[title] ?? { status: 'backlog', done: false }
        return { title, status: existing.status, done: existing.done }
      })

    // Build dlc array, preserving existing done-states
    const existingDlcMap = Object.fromEntries((game?.dlc ?? []).map(d => [d.title, d.done]))
    const dlc = form.dlc
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title, done: existingDlcMap[title] ?? false }))

    onSave({
      // Keep fields this form doesn't edit (tags, igdbId, lastSynced, …)
      ...(game ?? {}),
      title:         form.title.trim(),
      system:        resolvedSystem,
      genre:         form.genre,
      status:        form.status,
      ownership:     form.ownership,
      franchise:     form.franchise.trim(),
      timeToBeat:    form.timeToBeat ? Number(form.timeToBeat) : null,
      rating:        form.rating ? Number(form.rating) : null,
      notes:         form.notes.trim(),
      cover:         form.cover.trim(),
      released:      form.released.trim(),
      developer:     form.developer.trim() || undefined,
      criticScore:   form.criticScore ?? undefined,
      gameModes:     form.gameModes.length ? form.gameModes : undefined,
      perspectives:  form.perspectives.length ? form.perspectives : undefined,
      includedGames: includedGames.length ? includedGames : undefined,
      dlc:           dlc.length ? dlc : undefined,
    })
  }

  const systemOptions = [...new Set([...SYSTEMS, ...existingSystems])].sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{game ? 'Edit Game' : 'Add Game'}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {!game && (
            <p className="igdb-hint">
              <Icon name="sync" size={13} />
              <span>
                Want the cover, genre and time to beat filled in from IGDB?{' '}
                <a href={ADD_FROM_IGDB_URL} target="_blank" rel="noreferrer">Add it with the IGDB workflow</a>{' '}
                instead. The game shows up here about a minute after the run.
              </span>
            </p>
          )}

          {/* ── Cover ── */}
          {form.cover && (
            <div className="cover-picker-section">
              <div className="cover-preview-wrap">
                <img className="cover-preview" src={form.cover} alt="Cover" />
                <div className="cover-preview-actions">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => set('cover', '')}>
                    <Icon name="close" size={12} /> Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label>Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Elden Ring"
              autoFocus={!game}
            />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          <div className="field-row">
            <div className="field">
              <label>System *</label>
              <select value={form.system} onChange={e => set('system', e.target.value)}>
                <option value="">— Select —</option>
                {systemOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {form.system === 'Other' && (
                <input
                  className="mt-4"
                  value={customSystem}
                  onChange={e => setCustomSystem(e.target.value)}
                  placeholder="Enter system name"
                />
              )}
              {errors.system && <span className="field-error">{errors.system}</span>}
            </div>

            <div className="field">
              <label>Genre</label>
              <select value={form.genre} onChange={e => set('genre', e.target.value)}>
                <option value="">— Select —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="backlog">Not Started</option>
                <option value="playing">Playing</option>
                <option value="completed">Completed</option>
                <option value="shelved">Shelved</option>
                <option value="wishlist">Wishlist</option>
              </select>
            </div>

            <div className="field">
              <label>Ownership</label>
              <select value={form.ownership} onChange={e => set('ownership', e.target.value)}>
                <option value="">— Select —</option>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Developer</label>
              <input
                value={form.developer}
                onChange={e => set('developer', e.target.value)}
                placeholder="e.g. Nintendo"
              />
            </div>

            <div className="field">
              <label>Critic Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.criticScore ?? ''}
                onChange={e => set('criticScore', e.target.value ? Number(e.target.value) : null)}
                placeholder="0–100"
              />
            </div>
          </div>

          {/* ── Modes & perspectives (from IGDB, display only) ── */}
          {(form.gameModes.length > 0 || form.perspectives.length > 0) && (
            <div className="field">
              <label>
                Game Modes & Perspectives
                <span className="hltb-tag">from IGDB</span>
              </label>
              <div className="card-tags-row" style={{ marginTop: 4 }}>
                {form.gameModes.map(m => (
                  <span key={m} className="card-tag card-tag--mode">{m}</span>
                ))}
                {form.perspectives.map(p => (
                  <span key={p} className="card-tag card-tag--perspective">{p}</span>
                ))}
              </div>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Franchise / Series</label>
              <input
                value={form.franchise}
                onChange={e => set('franchise', e.target.value)}
                placeholder="e.g. God of War, Zelda"
              />
            </div>

            <div className="field">
              <label>Time to Beat</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.timeToBeat}
                onChange={e => set('timeToBeat', e.target.value)}
                placeholder="hrs, e.g. 40"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Rating</label>
              <select value={form.rating} onChange={e => set('rating', e.target.value)}>
                <option value="">No rating</option>
                <option value="1">★ 1</option>
                <option value="2">★★ 2</option>
                <option value="3">★★★ 3</option>
                <option value="4">★★★★ 4</option>
                <option value="5">★★★★★ 5</option>
              </select>
            </div>

            <div className="field">
              <label>Release Year</label>
              <input
                value={form.released}
                onChange={e => set('released', e.target.value)}
                placeholder="e.g. 2023"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="field">
            <label>Cover Image URL</label>
            <input
              value={form.cover}
              onChange={e => set('cover', e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any quick thoughts..."
              rows={3}
            />
          </div>

          <div className="field">
            <label>
              Included Games
              <span className="field-hint">For compilations — one title per line.</span>
            </label>
            <textarea
              value={form.includedGames}
              onChange={e => set('includedGames', e.target.value)}
              placeholder={"Mega Man 1\nMega Man 2\nMega Man 3"}
              rows={4}
            />
          </div>

          <div className="field">
            <label>
              DLC / Expansions
              <span className="field-hint">One title per line.</span>
            </label>
            <textarea
              value={form.dlc}
              onChange={e => set('dlc', e.target.value)}
              placeholder={"The Ringed City\nArias of a Starless Night"}
              rows={4}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{game ? 'Save Changes' : 'Add Game'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
