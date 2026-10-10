import { useState, useEffect, useCallback } from 'react'
import Icon from './components/Icon'
import GameCard from './components/GameCard'
import AddGameModal from './components/AddGameModal'
import FilterBar from './components/FilterBar'
import GameJournal from './components/GameJournal'
import AllJournal from './components/AllJournal'
import StatsPage from './components/StatsPage'
import RandomPicker from './components/RandomPicker'
import HomePage from './components/HomePage'
import ImportModal from './components/ImportModal'
import { enrichGame } from './api/igdb'
import { loadData, lsSave, exportData, isDirty } from './api/storage'
import './App.css'

const EMPTY_FILTERS = { status: 'all', system: 'all', genre: 'all', franchise: 'all', ownership: 'all', search: '' }

export default function App() {
  const [games, setGames]       = useState([])
  const [journal, setJournal]   = useState({})
  const [loaded, setLoaded]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [tab, setTab]           = useState('home')
  const [showModal, setShowModal]       = useState(false)
  const [editingGame, setEditingGame]   = useState(null)
  const [journalGame, setJournalGame]   = useState(null)
  const [showPicker, setShowPicker]     = useState(false)
  const [showImport, setShowImport]     = useState(false)
  const [filters, setFilters]   = useState(EMPTY_FILTERS)
  const [sortBy, setSortBy]     = useState('title')

  // ── Load from repo files on mount ────────────────────────────────────────────
  useEffect(() => {
    loadData().then(({ games: g, journal: j }) => {
      setGames(g)
      setJournal(j)
      setDirty(isDirty())
      setLoaded(true)
    })
  }, [])

  // ── Write-through: keep localStorage in sync and mark dirty ──────────────────
  useEffect(() => {
    if (!loaded) return
    lsSave(games, journal)
    setDirty(true)
  }, [games, journal, loaded])

  // ── Game CRUD ────────────────────────────────────────────────────────────────

  const addGame = (game) => {
    setGames(prev => [...prev, { ...game, id: Date.now() }])
    setShowModal(false)
  }

  const importGames = (incoming) => {
    const ts = Date.now()
    setGames(prev => [
      ...prev,
      ...incoming.map((g, i) => ({ ...g, id: ts + i })),
    ])
  }

  const updateGame = (updated) => {
    setGames(prev => prev.map(g => g.id === updated.id ? updated : g))
    setEditingGame(null)
    setShowModal(false)
  }

  const toggleIncluded = (gameId, index) => {
    setGames(prev => prev.map(g => {
      if (g.id !== gameId) return g
      const next = (g.includedGames ?? []).map((item, i) => {
        if (i !== index) return item
        const title = typeof item === 'string' ? item : item.title
        const done  = typeof item === 'string' ? true  : !item.done
        return { title, done }
      })
      return { ...g, includedGames: next }
    }))
  }

  const toggleDlc = (gameId, index) => {
    setGames(prev => prev.map(g => {
      if (g.id !== gameId) return g
      const next = (g.dlc ?? []).map((item, i) => {
        if (i !== index) return item
        return { ...item, done: !item.done }
      })
      return { ...g, dlc: next }
    }))
  }

  const deleteGame = (id) => {
    setGames(prev => prev.filter(g => g.id !== id))
    setJournal(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  const openEdit  = (game) => { setEditingGame(game); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditingGame(null) }

  // ── IGDB bulk sync ───────────────────────────────────────────────────────────
  const [syncState, setSyncState] = useState(null) // null | { done, total, errors, mode }

  const unsyncedCount = games.filter(g => !g.lastSynced).length

  const syncFromIGDB = useCallback(async (mode = 'new') => {
    // 'new'  = only games that have never been synced (no lastSynced field)
    // 'full' = all games regardless
    const toSync = mode === 'full'
      ? games
      : games.filter(g => !g.lastSynced)

    if (!toSync.length) {
      setSyncState({ done: 0, total: 0, errors: 0, mode, finished: true })
      return
    }

    setSyncState({ done: 0, total: toSync.length, errors: 0, mode })

    let errors = 0
    for (let i = 0; i < toSync.length; i++) {
      const g = toSync[i]
      try {
        const patch = await enrichGame(g.title)
        if (patch) {
          setGames(prev => prev.map(pg => {
            if (pg.id !== g.id) return pg
            return {
              ...pg,
              genre:        patch.genre        ?? pg.genre,
              franchise:    patch.franchise    ?? pg.franchise,
              tags:         patch.tags?.length   ? patch.tags         : (pg.tags ?? []),
              timeToBeat:   patch.timeToBeat   ?? pg.timeToBeat,
              developer:    patch.developer    ?? pg.developer,
              criticScore:  patch.criticScore  ?? pg.criticScore,
              gameModes:    patch.gameModes?.length ? patch.gameModes  : (pg.gameModes ?? []),
              perspectives: patch.perspectives?.length ? patch.perspectives : (pg.perspectives ?? []),
              // Merge DLC: keep existing done-states, add new entries with done:false
              dlc: (() => {
                const existing = Object.fromEntries((pg.dlc ?? []).map(d => [d.title, d.done]))
                const incoming = patch.dlc ?? pg.dlc ?? []
                return incoming.map(d => ({ ...d, done: existing[d.title] ?? d.done }))
              })(),
              cover:        pg.cover    || patch.cover    || pg.cover,
              released:     pg.released || patch.released || pg.released,
              lastSynced:   Date.now(),
            }
          }))
        }
      } catch {
        errors++
      }
      setSyncState({ done: i + 1, total: toSync.length, errors, mode })
      await new Promise(r => setTimeout(r, 260))
    }

    setSyncState(prev => ({ ...prev, finished: true }))
  }, [games])

  // ── Journal CRUD ─────────────────────────────────────────────────────────────

  const addEntry = (gameId, entry) => {
    setJournal(prev => ({ ...prev, [gameId]: [...(prev[gameId] ?? []), entry] }))
  }

  const deleteEntry = (gameId, entryId) => {
    setJournal(prev => ({ ...prev, [gameId]: (prev[gameId] ?? []).filter(e => e.id !== entryId) }))
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const ownedGames   = games.filter(g => g.status !== 'wishlist')
  const wishlistGames = games.filter(g => g.status === 'wishlist')

  const allSystems    = [...new Set(ownedGames.map(g => g.system))].sort()
  const allGenres     = [...new Set(ownedGames.map(g => g.genre).filter(Boolean))].sort()
  const allFranchises = [...new Set(games.map(g => g.franchise).filter(Boolean))].sort()

  const gamesWithCounts = games.map(g => ({
    ...g,
    journalCount: (journal[g.id] ?? []).length,
  }))

  const ownedWithCounts = gamesWithCounts.filter(g => g.status !== 'wishlist')

  const filtered = ownedWithCounts
    .filter(g => {
      if (filters.status    !== 'all' && g.status    !== filters.status)    return false
      if (filters.system    !== 'all' && g.system    !== filters.system)    return false
      if (filters.genre     !== 'all' && g.genre     !== filters.genre)     return false
      if (filters.franchise !== 'all' && g.franchise !== filters.franchise) return false
      if (filters.ownership !== 'all' && g.ownership !== filters.ownership) return false
      if (filters.search && !g.title.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':      return a.title.localeCompare(b.title)
        case 'title-desc': return b.title.localeCompare(a.title)
        case 'system':     return a.system.localeCompare(b.system)
        case 'rating':     return (b.rating ?? 0) - (a.rating ?? 0)
        case 'rating-asc': return (a.rating ?? 0) - (b.rating ?? 0)
        case 'ttb':        return (a.timeToBeat ?? Infinity) - (b.timeToBeat ?? Infinity)
        case 'added':      return b.id - a.id
        case 'added-asc':  return a.id - b.id
        default:           return 0
      }
    })

  const counts = {
    all:       ownedGames.length,
    playing:   games.filter(g => g.status === 'playing').length,
    backlog:   games.filter(g => g.status === 'backlog').length,
    completed: games.filter(g => g.status === 'completed').length,
    shelved:   games.filter(g => g.status === 'shelved').length,
    wishlist:  wishlistGames.length,
  }

  if (!loaded) return <div className="app-loading">Loading…</div>

  const handleExport = async () => {
    await exportData(games, journal)
    setDirty(false)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-title">
            <Icon name="gamepad" size={20} style={{ color: 'var(--color-accent)' }} />
            <h1>Backlog Tracker</h1>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" title="Random Picker" onClick={() => setShowPicker(true)}><Icon name="dice" size={14} /> Random</button>
            <button className="btn-ghost" title="Import from CSV" onClick={() => setShowImport(true)}><Icon name="import" size={14} /> Import</button>
            <button
              className={`btn-ghost${dirty ? ' btn-ghost--dirty' : ''}`}
              title="Download games.json and journal.json to commit to the repo"
              onClick={handleExport}
            >
              <Icon name="import" size={14} style={{ transform: 'rotate(180deg)' }} />
              {dirty ? ' Save*' : ' Save'}
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} /> Add Game</button>
          </div>
        </div>
        <nav className="tab-bar">
          <button className={`tab-btn${tab === 'home'       ? ' tab-btn--active' : ''}`} onClick={() => setTab('home')}><Icon name="home" size={14} /> Home</button>
          <button className={`tab-btn${tab === 'collection' ? ' tab-btn--active' : ''}`} onClick={() => setTab('collection')}><Icon name="collection" size={14} /> Collection</button>
          <button className={`tab-btn${tab === 'wishlist'   ? ' tab-btn--active' : ''}`} onClick={() => setTab('wishlist')}><Icon name="wishlist" size={14} /> Wishlist{counts.wishlist > 0 ? ` (${counts.wishlist})` : ''}</button>
          <button className={`tab-btn${tab === 'journal'    ? ' tab-btn--active' : ''}`} onClick={() => setTab('journal')}><Icon name="journal" size={14} /> Journal</button>
          <button className={`tab-btn${tab === 'stats'      ? ' tab-btn--active' : ''}`} onClick={() => setTab('stats')}><Icon name="stats" size={14} /> Stats</button>
        </nav>
      </header>

      <main className="main">
        {tab === 'home' && (
          <HomePage
            games={gamesWithCounts}
            journal={journal}
            onOpenJournal={setJournalGame}
            onOpenGame={openEdit}
            counts={counts}
          />
        )}

        {tab === 'collection' && (
          <>
            <div className="stats-row">
              <StatPill label="Total"     count={filtered.length}                                             color="var(--color-text)" />
              <StatPill label="Playing"   count={filtered.filter(g => g.status === 'playing').length}         color="var(--color-playing)" />
              <StatPill label="Backlog"   count={filtered.filter(g => g.status === 'backlog').length}         color="var(--color-backlog)" />
              <StatPill label="Completed" count={filtered.filter(g => g.status === 'completed').length}       color="var(--color-completed)" />
              {filtered.some(g => g.status === 'shelved') && <StatPill label="Shelved"  count={filtered.filter(g => g.status === 'shelved').length}              color="var(--color-shelved)" />}
              {filtered.some(g => g.ownership === 'physical' || g.ownership === 'both') && <StatPill label="Physical" count={filtered.filter(g => g.ownership === 'physical' || g.ownership === 'both').length} color="var(--color-muted)" />}
              {filtered.some(g => g.ownership === 'digital'  || g.ownership === 'both') && <StatPill label="Digital"  count={filtered.filter(g => g.ownership === 'digital'  || g.ownership === 'both').length} color="var(--color-muted)" />}
            </div>

            <FilterBar
              filters={filters}
              setFilters={setFilters}
              sortBy={sortBy}
              setSortBy={setSortBy}
              systems={allSystems}
              genres={allGenres}
              franchises={allFranchises}
            />

            {filtered.length === 0 ? (
              <div className="empty-state">
                <p>No games match your filters.</p>
              </div>
            ) : (
              <div className="game-grid">
                {filtered.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onEdit={openEdit}
                    onDelete={deleteGame}
                    onOpenJournal={setJournalGame}
                    onToggleIncluded={toggleIncluded}
                    onToggleDlc={toggleDlc}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'wishlist' && (
          <WishlistTab
            games={gamesWithCounts.filter(g => g.status === 'wishlist')}
            onEdit={openEdit}
            onDelete={deleteGame}
            onMoveToCollection={(game) => updateGame({ ...game, status: 'backlog' })}
          />
        )}

        {tab === 'journal' && (
          <AllJournal
            games={games}
            journal={journal}
            onDeleteEntry={deleteEntry}
            onOpenJournal={setJournalGame}
          />
        )}

        {tab === 'stats' && (
          <StatsPage
            allGames={games}
            journal={journal}
            onSyncIGDB={syncFromIGDB}
            syncState={syncState}
            onClearSync={() => setSyncState(null)}
            unsyncedCount={unsyncedCount}
          />
        )}
      </main>

      {showModal && (
        <AddGameModal
          game={editingGame}
          onSave={editingGame ? updateGame : addGame}
          onClose={closeModal}
          existingSystems={allSystems}
        />
      )}

      {journalGame && (
        <GameJournal
          game={journalGame}
          entries={journal[journalGame.id] ?? []}
          onAddEntry={addEntry}
          onDeleteEntry={deleteEntry}
          onClose={() => setJournalGame(null)}
        />
      )}

      {showPicker && (
        <RandomPicker
          games={gamesWithCounts}
          onClose={() => setShowPicker(false)}
          onEdit={openEdit}
        />
      )}

      {showImport && (
        <ImportModal
          existingGames={games}
          onImport={(incoming) => { importGames(incoming); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

function WishlistTab({ games, onEdit, onDelete, onMoveToCollection }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('title')

  const filtered = games
    .filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':  return a.title.localeCompare(b.title)
        case 'system': return a.system.localeCompare(b.system)
        case 'ttb':    return (a.timeToBeat ?? Infinity) - (b.timeToBeat ?? Infinity)
        case 'added':  return b.id - a.id
        default:       return 0
      }
    })

  return (
    <div>
      <div className="wishlist-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search wishlist..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-group">
          <label>Sort by</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="title">Title (A–Z)</option>
            <option value="system">System</option>
            <option value="ttb">Time to Beat</option>
            <option value="added">Date Added</option>
          </select>
        </div>
        <span className="wishlist-count">{games.length} {games.length === 1 ? 'game' : 'games'}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{games.length === 0 ? 'Your wishlist is empty.' : 'No games match your search.'}</p>
          {games.length === 0 && <p className="empty-state-sub">Add a game and set its status to Wishlist.</p>}
        </div>
      ) : (
        <div className="game-grid">
          {filtered.map(game => (
            <div key={game.id} className={`game-card status-${game.status}`}>
              {game.cover && (
                <div className="card-cover-wrap">
                  <img className="card-cover" src={game.cover} alt={game.title} loading="lazy" />
                  <div className="card-cover-overlay" />
                </div>
              )}
              <div className="card-body">
                <div className="card-header">
                  <span className="status-badge status-badge--wishlist">Wishlist</span>
                  <div className="card-actions">
                    <button className="icon-btn" title="Edit" onClick={() => onEdit(game)}><Icon name="edit" size={14} /></button>
                    <button className="icon-btn" title="Delete" onClick={() => onDelete(game.id)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
                <h2 className="card-title">{game.title}</h2>
                <div className="card-meta-row">
                  <p className="card-system">{game.system}</p>
                  {game.released && <p className="card-released">{game.released}</p>}
                </div>
                {game.franchise && <p className="card-franchise"><Icon name="books" size={12} /> {game.franchise}</p>}
                <div className="card-tags-row">
                  {game.genre && <span className="card-tag">{game.genre}</span>}
                  {game.timeToBeat && <span className="card-tag card-tag--time"><Icon name="timer" size={11} /> {game.timeToBeat}h</span>}
                </div>
                {game.notes && <p className="card-notes">{game.notes}</p>}
                <button
                  className="move-to-collection-btn"
                  onClick={() => onMoveToCollection(game)}
                  title="Move to backlog"
                ><Icon name="check" size={13} /> Add to Collection</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



function StatPill({ label, count, color }) {
  return (
    <div className="stat-pill">
      <span className="stat-count" style={{ color }}>{count}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
