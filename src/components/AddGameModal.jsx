import { useState, useEffect, useRef, useCallback } from 'react'
import { searchGames, getGameImages, getBundledGames, getTimeToBeat, PLATFORM_ID_MAP } from '../api/igdb'
import { getHLTB } from '../api/hltb'
import Icon from './Icon'

const SYSTEMS = [
  // Current
  'Nintendo Switch', 'Nintendo Switch 2', 'PlayStation 5', 'PlayStation 4',
  'Xbox Series X/S', 'Xbox One', 'PC',
  // Last gen
  'PlayStation 3', 'Xbox 360', 'Wii U', 'Wii',
  // Nintendo handhelds
  'Nintendo 3DS', 'Nintendo DS', 'Game Boy Advance', 'Game Boy Color', 'Game Boy',
  // Nintendo home consoles
  'GameCube', 'Nintendo 64', 'Super Nintendo', 'NES',
  // PlayStation legacy
  'PlayStation 2', 'PlayStation',
  // Xbox legacy
  'Xbox',
  // Sega
  'Dreamcast', 'Sega Saturn', 'Sega Genesis',
  // Mobile
  'iOS', 'Android',
  'Other',
]

const GENRES = [
  'Action', 'Action-Adventure', 'Adventure', 'Fighting', 'Horror',
  'JRPG', 'Metroidvania', 'Platformer', 'Puzzle', 'Racing',
  'Roguelike', 'RPG', 'Shooter', 'Simulation', 'Sports',
  'Strategy', 'Survival', 'Visual Novel', 'Other',
]

const EMPTY = { title: '', system: '', genre: '', status: 'backlog', ownership: '', franchise: '', timeToBeat: '', rating: '', notes: '', cover: '', released: '', includedGames: '', developer: '', criticScore: null, gameModes: [], perspectives: [], dlc: '' }

const API_ENABLED = Boolean(import.meta.env.VITE_IGDB_CLIENT_ID)

// Simple debounce
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AddGameModal({ game, onSave, onClose, existingSystems }) {
  const [form, setForm] = useState(EMPTY)
  const [customSystem, setCustomSystem] = useState('')
  const [errors, setErrors] = useState({})

  // IGDB search state
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [gamePicked, setGamePicked] = useState(false)
  const dropdownRef = useRef(null)

  const debouncedQuery = useDebounce(searchQuery, 350)

  // Populate form when editing an existing game
  useEffect(() => {
    if (game) {
      setForm({
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
      })
      if (!SYSTEMS.includes(game.system)) setCustomSystem(game.system)
      setGamePicked(true)
      // Seed image options with existing cover; resolve igdbId for screenshot fetching
      if (game.cover) setImageOptions([game.cover])
      if (API_ENABLED) {
        searchGames(game.title).then(results => {
          const match = results[0]
          if (match) {
            setIgdbId(match.igdbId)
            setImageOptions(prev => prev.includes(match.cover) || !match.cover ? prev : [match.cover, ...prev])
          }
        }).catch(() => {})
      }
    }
  }, [game])

  // Fire IGDB search when debounced query changes
  useEffect(() => {
    if (!API_ENABLED || !debouncedQuery.trim() || gamePicked) {
      setResults([])
      setShowResults(false)
      return
    }
    let cancelled = false
    setSearching(true)
    setSearchError('')
    const resolvedSystem = form.system === 'Other' ? customSystem.trim() : form.system
    const platformId = PLATFORM_ID_MAP[resolvedSystem] ?? null
    searchGames(debouncedQuery, platformId)
      .then(r => { if (!cancelled) { setResults(r); setShowResults(true) } })
      .catch(() => { if (!cancelled) setSearchError('Search failed. Check your API key.') })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, gamePicked, form.system, customSystem])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [igdbPlatforms, setIgdbPlatforms] = useState([])
  const [igdbId, setIgdbId]               = useState(null)
  const [ttbLoading, setTtbLoading]       = useState(false)

  // Image picker state
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [imageOptions, setImageOptions]       = useState([])
  const [imagesLoading, setImagesLoading]     = useState(false)

  const [bundleLoading, setBundleLoading] = useState(false)
  const [franchiseAutoFilled, setFranchiseAutoFilled] = useState(false)

  const pickResult = useCallback((result) => {
    const knownSystem = result.platforms.find(p => SYSTEMS.includes(p)) ?? result.platforms[0] ?? ''
    const genre = GENRES.find(g => result.genres.includes(g)) ?? result.genres[0] ?? ''

    setForm(prev => ({
      ...prev,
      title:        result.title,
      system:       SYSTEMS.includes(knownSystem) ? knownSystem : 'Other',
      genre:        genre,
      cover:        result.cover ?? '',
      released:     result.released ?? '',
      franchise:    result.franchise ?? prev.franchise,
      developer:    result.developer ?? prev.developer,
      criticScore:  result.criticScore ?? prev.criticScore,
      gameModes:    result.gameModes?.length ? result.gameModes : prev.gameModes,
      perspectives: result.perspectives?.length ? result.perspectives : prev.perspectives,
      dlc:          result.dlc?.length
        ? result.dlc.map(d => d.title).join('\n')
        : prev.dlc,
    }))
    setFranchiseAutoFilled(Boolean(result.franchise))
    if (!SYSTEMS.includes(knownSystem)) setCustomSystem(knownSystem)
    setIgdbPlatforms(result.platforms.filter(p => SYSTEMS.includes(p)))
    setIgdbId(result.igdbId)
    // Pre-load image options (background_image + screenshots)
    setImageOptions(result.cover ? [result.cover] : [])
    setSearchQuery(result.title)
    setShowResults(false)
    setGamePicked(true)

    // Fetch time-to-beat from IGDB, fall back to HLTB if not found
    setTtbLoading(true)
    getTimeToBeat(result.igdbId)
      .then(async hours => {
        if (hours != null) return hours
        return getHLTB(result.title).catch(() => null)
      })
      .then(hours => {
        if (hours != null) setForm(prev => ({ ...prev, timeToBeat: hours }))
      })
      .catch(() => {})
      .finally(() => setTtbLoading(false))

    // Fetch bundled games from IGDB in the background
    setBundleLoading(true)
    getBundledGames(result.igdbId)
      .then(names => {
        if (names.length) setForm(prev => ({ ...prev, includedGames: names.join('\n') }))
      })
      .catch(() => {})
      .finally(() => setBundleLoading(false))
  }, [])

  const openImagePicker = () => {
    setShowImagePicker(true)
    if (igdbId && imageOptions.length <= 1) {
      setImagesLoading(true)
      getGameImages(igdbId)
        .then(imgs => {
          // Merge: keep current cover first if present, then screenshots
          setImageOptions(prev => {
            const all = [...new Set([...prev, ...imgs])]
            return all
          })
        })
        .catch(() => {})
        .finally(() => setImagesLoading(false))
    }
  }

  const clearPick = () => {
    setGamePicked(false)
    setSearchQuery('')
    setForm(EMPTY)
    setCustomSystem('')
    setIgdbPlatforms([])
    setIgdbId(null)
    setImageOptions([])
    setShowImagePicker(false)
    setFranchiseAutoFilled(false)
  }

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

    // Build new includedGames, preserving existing done state where titles match
    const existingMap = Object.fromEntries(
      (game?.includedGames ?? []).map(g =>
        typeof g === 'string' ? [g, false] : [g.title, g.done]
      )
    )
    const includedGames = form.includedGames
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title, done: existingMap[title] ?? false }))

    // Build dlc array, preserving existing done-states
    const existingDlcMap = Object.fromEntries((game?.dlc ?? []).map(d => [d.title, d.done]))
    const dlc = form.dlc
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title, done: existingDlcMap[title] ?? false }))

    onSave({
      ...(game ? { id: game.id } : {}),
      title:         form.title.trim(),
      system:        resolvedSystem,
      genre:         form.genre,
      status:        form.status,
      ownership:     form.ownership,
      franchise:     form.franchise.trim(),
      timeToBeat:    form.timeToBeat ? Number(form.timeToBeat) : null,
      rating:        form.rating ? Number(form.rating) : null,
      notes:         form.notes.trim(),
      cover:         form.cover,
      released:      form.released,
      developer:     form.developer.trim() || undefined,
      criticScore:   form.criticScore ?? undefined,
      gameModes:     form.gameModes.length ? form.gameModes : undefined,
      perspectives:  form.perspectives.length ? form.perspectives : undefined,
      includedGames: includedGames.length ? includedGames : undefined,
      dlc:           dlc.length ? dlc : undefined,
    })
  }

  const systemOptions = (() => {
    const all = [...new Set([...SYSTEMS, ...existingSystems])]
    return all.sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      // IGDB platforms bubble to the top when a game has been picked
      const aRawg = igdbPlatforms.indexOf(a)
      const bRawg = igdbPlatforms.indexOf(b)
      if (aRawg !== -1 && bRawg !== -1) return aRawg - bRawg
      if (aRawg !== -1) return -1
      if (bRawg !== -1) return 1
      return a.localeCompare(b)
    })
  })()

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{game ? 'Edit Game' : 'Add Game'}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* ── IGDB search ── */}
          {API_ENABLED && (
            <div className="field" ref={dropdownRef}>
              <label>Search Database {searching && <span className="search-spinner"><Icon name="sync" size={12} /></span>}</label>
              <div className="search-db-wrap">
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setGamePicked(false) }}
                  placeholder="Search IGDB for a game…"
                  autoFocus={!game}
                  autoComplete="off"
                />
                {gamePicked && (
                  <button type="button" className="search-clear-btn" onClick={clearPick} title="Clear"><Icon name="close" size={12} /></button>
                )}
              </div>
              {searchError && <span className="field-error">{searchError}</span>}

              {showResults && results.length > 0 && (
                <ul className="search-results">
                  {results.map(r => (
                    <li key={r.igdbId} className="search-result" onMouseDown={() => pickResult(r)}>
                      {r.cover
                        ? <img className="result-thumb" src={r.cover} alt="" loading="lazy" />
                        : <div className="result-thumb result-thumb--placeholder"><Icon name="gamepad" size={18} /></div>
                      }
                      <div className="result-info">
                        <span className="result-title">{r.title}</span>
                        <span className="result-meta">
                          {r.released && `${r.released} · `}
                          {r.platforms.slice(0, 3).join(', ')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {showResults && results.length === 0 && !searching && (
                <div className="search-results search-results--empty">No results found</div>
              )}
            </div>
          )}

          {/* ── Cover image picker ── */}
          {(form.cover || imageOptions.length > 0) && (
            <div className="cover-picker-section">
              <div className="cover-preview-wrap">
                {form.cover
                  ? <img className="cover-preview" src={form.cover} alt="Cover" />
                  : <div className="cover-preview cover-preview--empty"><Icon name="gamepad" size={32} /></div>
                }
                <div className="cover-preview-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={openImagePicker}
                  ><Icon name="image" size={13} /> Change Image</button>
                  {form.cover && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => set('cover', '')}
                    ><Icon name="close" size={12} /> Remove</button>
                  )}
                </div>
              </div>

              {showImagePicker && (
                <div className="image-picker">
                  <div className="image-picker-header">
                    <span className="image-picker-label">Choose an image</span>
                    {imagesLoading && <span className="search-spinner"><Icon name="sync" size={12} /></span>}
                    <button type="button" className="icon-btn" onClick={() => setShowImagePicker(false)}><Icon name="close" size={14} /></button>
                  </div>
                  <div className="image-picker-grid">
                    {imageOptions.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`image-option${form.cover === url ? ' image-option--active' : ''}`}
                        onClick={() => { set('cover', url); setShowImagePicker(false) }}
                      >
                        <img src={url} alt="" loading="lazy" />
                        {form.cover === url && <span className="image-option-check"><Icon name="check" size={12} /></span>}
                      </button>
                    ))}
                    {!imagesLoading && imageOptions.length === 0 && (
                      <p className="image-picker-empty">No images available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Manual / pre-filled fields ── */}
          <div className="field">
            <label>Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Elden Ring"
              autoFocus={!API_ENABLED && !game}
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

          {/* ── Developer (auto-filled from IGDB, editable) ── */}
          <div className="field-row">
            <div className="field">
              <label>
                Developer
                {form.developer && gamePicked && <span className="hltb-tag">from IGDB</span>}
              </label>
              <input
                value={form.developer}
                onChange={e => set('developer', e.target.value)}
                placeholder="e.g. Nintendo"
              />
            </div>

            <div className="field">
              <label>
                Critic Score
                {form.criticScore != null && gamePicked && <span className="hltb-tag">from IGDB</span>}
              </label>
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

          {/* ── Modes & perspectives (IGDB-sourced display) ── */}
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
              <label>
                Franchise / Series
                {franchiseAutoFilled && <span className="hltb-tag">from IGDB</span>}
              </label>
              <input
                value={form.franchise}
                onChange={e => { set('franchise', e.target.value); setFranchiseAutoFilled(false) }}
                placeholder="e.g. God of War, Zelda"
              />
            </div>

            <div className="field">
              <label>
                Time to Beat {ttbLoading && <span className="search-spinner"><Icon name="sync" size={12} /></span>}
                {!ttbLoading && form.timeToBeat && gamePicked && <span className="hltb-tag">from IGDB</span>}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.timeToBeat}
                onChange={e => set('timeToBeat', e.target.value)}
                placeholder={ttbLoading ? 'Looking up…' : 'hrs, e.g. 40'}
                disabled={ttbLoading}
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
          </div>

          {form.released && (
            <div className="field">
              <label>Release Year</label>
              <input value={form.released} onChange={e => set('released', e.target.value)} />
            </div>
          )}

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
              Included Games {bundleLoading && <span className="search-spinner"><Icon name="sync" size={12} /></span>}
              {!bundleLoading && form.includedGames && gamePicked && (
                <span className="hltb-tag">auto-filled</span>
              )}
              <span className="field-hint">For compilations — one title per line. Auto-detected from IGDB.</span>
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
              {form.dlc && gamePicked && <span className="hltb-tag">from IGDB</span>}
              <span className="field-hint">One title per line. Auto-detected from IGDB.</span>
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
