import { useState } from 'react'
import Icon from './Icon'

function pct(n, total) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

function topN(map, n = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

function BarRow({ label, value, max, color }) {
  const width = max ? pct(value, max) : 0
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%`, background: color ?? 'var(--color-accent)' }} />
      </div>
      <span className="bar-value">{value}</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="scard">
      <span className="scard-value" style={color ? { color } : {}}>{value}</span>
      <span className="scard-label">{label}</span>
      {sub && <span className="scard-sub">{sub}</span>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="stats-section">
      <h3 className="stats-section-title">{title}</h3>
      {children}
    </div>
  )
}

function StatusPie({ byStatus, total }) {
  if (!total) return null

  const finishedCount = (byStatus.completed ?? 0) + (byStatus.shelved ?? 0)
  const slices = [
    { key: 'finished', count: finishedCount,          color: 'var(--color-completed)', label: 'Completed / Shelved' },
    { key: 'playing',  count: byStatus.playing ?? 0,  color: 'var(--color-playing)',   label: 'Playing' },
    { key: 'backlog',  count: byStatus.backlog ?? 0,  color: 'var(--color-backlog)',   label: 'Not Started' },
  ].filter(s => s.count > 0)

  // Build SVG donut slices — strokeDashoffset trick:
  // Each circle shows one coloured arc. offset starts at C/4 (12 o'clock) and
  // decreases by each segment's arc length so they stack clockwise.
  const r = 40, cx = 50, cy = 50, stroke = 14
  const circumference = 2 * Math.PI * r
  let cumulativeDash = 0
  const segments = slices.map(s => {
    const dash = (s.count / total) * circumference
    const dashOffset = circumference * 0.25 - cumulativeDash
    cumulativeDash += dash
    return { ...s, dash, dashOffset }
  })

  const finishedPct = Math.round((finishedCount / total) * 100)

  return (
    <div className="pie-wrap">
      <svg className="pie-svg" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        {segments.map(s => (
          <circle
            key={s.key}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.dashOffset}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" className="pie-center-pct">{finishedPct}%</text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="pie-center-label">finished</text>
      </svg>
      <div className="pie-legend">
        {slices.map(s => (
          <div key={s.key} className="pie-legend-row">
            <span className="pie-legend-dot" style={{ background: s.color }} />
            <span className="pie-legend-label">{s.label}</span>
            <span className="pie-legend-value">{s.count} <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: '0.72rem' }}>({Math.round((s.count / total) * 100)}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage({ allGames, journal }) {
  // ── Stat filters ─────────────────────────────────────────────────────────────
  const [filterStatus,    setFilterStatus]    = useState('all')
  const [filterSystem,    setFilterSystem]    = useState('all')
  const [filterGenre,     setFilterGenre]     = useState('all')
  const [filterFranchise, setFilterFranchise] = useState('all')
  const [filterDeveloper, setFilterDeveloper] = useState('all')
  const [filterOwnership, setFilterOwnership] = useState('all')

  // Owned = everything except wishlist
  const owned = allGames.filter(g => g.status !== 'wishlist')
  const wishlistCount = allGames.filter(g => g.status === 'wishlist').length

  // Options for dropdowns derived from owned games
  const systems    = [...new Set(owned.map(g => g.system))].sort()
  const genres     = [...new Set(owned.map(g => g.genre).filter(Boolean))].sort()
  const franchises = [...new Set(owned.map(g => g.franchise).filter(Boolean))].sort()
  const developers = [...new Set(owned.map(g => g.developer).filter(Boolean))].sort()

  // Apply filters to owned games
  const games = owned.filter(g => {
    if (filterStatus    !== 'all' && g.status    !== filterStatus)    return false
    if (filterSystem    !== 'all' && g.system    !== filterSystem)    return false
    if (filterGenre     !== 'all' && g.genre     !== filterGenre)     return false
    if (filterFranchise !== 'all' && g.franchise !== filterFranchise) return false
    if (filterDeveloper !== 'all' && g.developer !== filterDeveloper) return false
    if (filterOwnership === 'physical' && g.ownership !== 'physical' && g.ownership !== 'both') return false
    if (filterOwnership === 'digital'  && g.ownership !== 'digital'  && g.ownership !== 'both') return false
    return true
  })

  const anyFilter = filterStatus !== 'all' || filterSystem !== 'all' || filterGenre !== 'all' || filterFranchise !== 'all' || filterDeveloper !== 'all' || filterOwnership !== 'all'

  const clearFilters = () => {
    setFilterStatus('all');    setFilterSystem('all')
    setFilterGenre('all');     setFilterFranchise('all')
    setFilterDeveloper('all'); setFilterOwnership('all')
  }

  const total = games.length

  if (owned.length === 0) {
    return (
      <div className="empty-state">
        <p>No owned games in your collection yet.</p>
        <p className="empty-state-sub">Add games with a status of Playing, Not Started, or Completed to see stats.</p>
      </div>
    )
  }

  // ── Status breakdown ─────────────────────────────────────────────────────────
  const byStatus = { playing: 0, backlog: 0, completed: 0, shelved: 0 }
  games.forEach(g => { byStatus[g.status] = (byStatus[g.status] ?? 0) + 1 })

  // ── Franchise breakdown ──────────────────────────────────────────────────────
  const franchiseMap = {}
  games.forEach(g => { if (g.franchise) franchiseMap[g.franchise] = (franchiseMap[g.franchise] ?? 0) + 1 })
  const topFranchises = topN(franchiseMap)
  const maxFranchise  = topFranchises[0]?.[1] ?? 1

  // ── Time to beat ─────────────────────────────────────────────────────────────
  const withTTB    = games.filter(g => g.timeToBeat)
  const avgTTB     = withTTB.length ? (withTTB.reduce((s, g) => s + g.timeToBeat, 0) / withTTB.length).toFixed(1) : null
  const backlogTTB = games.filter(g => g.status === 'backlog' && g.timeToBeat).reduce((s, g) => s + g.timeToBeat, 0)

  // ── Ownership breakdown ──────────────────────────────────────────────────────
  const physicalCount = games.filter(g => g.ownership === 'physical' || g.ownership === 'both').length
  const digitalCount  = games.filter(g => g.ownership === 'digital'  || g.ownership === 'both').length
  const untagged      = games.filter(g => !g.ownership).length

  // ── By system ────────────────────────────────────────────────────────────────
  const systemMap = {}
  games.forEach(g => { systemMap[g.system] = (systemMap[g.system] ?? 0) + 1 })
  const topSystems = topN(systemMap)
  const maxSystem  = topSystems[0]?.[1] ?? 1

  // ── Completion rate by system ────────────────────────────────────────────────
  const systemCompletion = Object.keys(systemMap)
    .map(sys => {
      const sysGames = games.filter(g => g.system === sys)
      const finished = sysGames.filter(g => g.status === 'completed' || g.status === 'shelved').length
      return { sys, total: sysGames.length, finished, pct: Math.round((finished / sysGames.length) * 100) }
    })
    .filter(s => s.total >= 2)
    .sort((a, b) => b.pct - a.pct)

  // ── By genre ─────────────────────────────────────────────────────────────────
  const genreMap = {}
  games.forEach(g => { if (g.genre) genreMap[g.genre] = (genreMap[g.genre] ?? 0) + 1 })
  const topGenres = topN(genreMap)
  const maxGenre  = topGenres[0]?.[1] ?? 1

  // ── By IGDB theme tags ────────────────────────────────────────────────────────
  const tagMap = {}
  games.forEach(g => (g.tags ?? []).forEach(t => { tagMap[t] = (tagMap[t] ?? 0) + 1 }))
  const topTags = topN(tagMap, 8)
  const maxTag  = topTags[0]?.[1] ?? 1

  // ── By developer ─────────────────────────────────────────────────────────────
  const devMap = {}
  games.forEach(g => { if (g.developer) devMap[g.developer] = (devMap[g.developer] ?? 0) + 1 })
  const topDevs = topN(devMap, 8)
  const maxDev  = topDevs[0]?.[1] ?? 1

  // ── Game modes ───────────────────────────────────────────────────────────────
  const modeMap = {}
  games.forEach(g => (g.gameModes ?? []).forEach(m => { modeMap[m] = (modeMap[m] ?? 0) + 1 }))
  const topModes = topN(modeMap, 6)
  const maxMode  = topModes[0]?.[1] ?? 1

  // ── Player perspectives ───────────────────────────────────────────────────────
  const perspMap = {}
  games.forEach(g => (g.perspectives ?? []).forEach(p => { perspMap[p] = (perspMap[p] ?? 0) + 1 }))
  const topPerspectives = topN(perspMap, 6)
  const maxPersp        = topPerspectives[0]?.[1] ?? 1

  // ── Critic score ─────────────────────────────────────────────────────────────
  const withCritic = games.filter(g => g.criticScore != null)
  const avgCritic  = withCritic.length
    ? Math.round(withCritic.reduce((s, g) => s + g.criticScore, 0) / withCritic.length)
    : null
  // Score distribution in bands: 90–100, 75–89, 50–74, 25–49, 0–24
  const criticBands = [
    { label: '90–100', min: 90, max: 100, color: '#22c55e' },
    { label: '75–89',  min: 75, max: 89,  color: '#f59e0b' },
    { label: '50–74',  min: 50, max: 74,  color: '#f97316' },
    { label: '25–49',  min: 25, max: 49,  color: '#ef4444' },
    { label: '0–24',   min: 0,  max: 24,  color: '#64748b' },
  ].map(b => ({ ...b, count: withCritic.filter(g => g.criticScore >= b.min && g.criticScore <= b.max).length }))
  const maxCriticBand = Math.max(...criticBands.map(b => b.count), 1)

  // ── Ratings ──────────────────────────────────────────────────────────────────
  const rated     = games.filter(g => g.rating)
  const avgRating = rated.length
    ? (rated.reduce((s, g) => s + g.rating, 0) / rated.length).toFixed(1)
    : '—'
  const ratingDist = [5, 4, 3, 2, 1].map(r => [r, rated.filter(g => g.rating === r).length])
  const maxRating  = Math.max(...ratingDist.map(([, c]) => c), 1)

  // ── Journal ──────────────────────────────────────────────────────────────────
  const totalEntries = games.reduce((s, g) => s + (journal[g.id] ?? []).length, 0)
  const journalCounts = games
    .map(g => ({ title: g.title, count: (journal[g.id] ?? []).length }))
    .filter(g => g.count > 0)
    .sort((a, b) => b.count - a.count)
  const mostJournalled = journalCounts[0] ?? null

  const allEntries = []
  games.forEach(g => (journal[g.id] ?? []).forEach(e => allEntries.push({ ...e, gameTitle: g.title })))
  allEntries.sort((a, b) => b.date.localeCompare(a.date))
  const latestEntry = allEntries[0] ?? null

  // ── Completion rate ──────────────────────────────────────────────────────────
  const completionPct = pct(byStatus.completed + byStatus.shelved, total)

  return (
    <div className="stats-page">

      {/* ── Filters ── */}
      <div className="stats-filters">
        <span className="stats-filters-label">Filter stats by</span>

        <div className="filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Owned</option>
            <option value="playing">Playing</option>
            <option value="backlog">Not Started</option>
            <option value="completed">Completed</option>
            <option value="shelved">Shelved</option>
          </select>
        </div>

        {systems.length > 1 && (
          <div className="filter-group">
            <label>System</label>
            <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)}>
              <option value="all">All Systems</option>
              {systems.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {genres.length > 1 && (
          <div className="filter-group">
            <label>Genre</label>
            <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
              <option value="all">All Genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {franchises.length > 1 && (
          <div className="filter-group">
            <label>Franchise</label>
            <select value={filterFranchise} onChange={e => setFilterFranchise(e.target.value)}>
              <option value="all">All Franchises</option>
              {franchises.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}

        {developers.length > 1 && (
          <div className="filter-group">
            <label>Developer</label>
            <select value={filterDeveloper} onChange={e => setFilterDeveloper(e.target.value)}>
              <option value="all">All Developers</option>
              {developers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>Ownership</label>
          <select value={filterOwnership} onChange={e => setFilterOwnership(e.target.value)}>
            <option value="all">All</option>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
          </select>
        </div>

        {anyFilter && (
          <button className="btn-ghost filter-clear" onClick={clearFilters}><Icon name="close" size={12} /> Clear</button>
        )}

        <span className="stats-scope">
          {anyFilter ? `Showing ${total} of ${owned.length} owned games` : `${total} owned games · ${wishlistCount} wishlisted`}
        </span>

      </div>

      {total === 0 ? (
        <div className="empty-state">
          <p>No games match the current filters.</p>
        </div>
      ) : (
        <>
          {/* ── At a glance ── */}
          <Section title="At a Glance">
            <div className="scard-grid">
              <StatCard label="Owned Games"     value={total} />
              <StatCard label="Completed"       value={byStatus.completed}  color="var(--color-completed)" sub={`${completionPct}% done or shelved`} />
              <StatCard label="Shelved"         value={byStatus.shelved}    color="var(--color-shelved)" />
              <StatCard label="Playing"         value={byStatus.playing}    color="var(--color-playing)" />
              <StatCard label="Not Started"     value={byStatus.backlog}    color="var(--color-backlog)" />
              <StatCard label="Avg Rating"      value={avgRating}           sub={rated.length ? `${rated.length} rated` : 'none rated'} />
              {avgCritic != null && <StatCard label="Avg Critic Score" value={`${avgCritic}/100`} sub={`${withCritic.length} scored`} color="var(--color-accent)" />}
              <StatCard label="Journal Entries" value={totalEntries} />
              {avgTTB && <StatCard label="Avg Time to Beat" value={`${avgTTB}h`} sub={`${withTTB.length} tagged`} />}
              {backlogTTB > 0 && <StatCard label="Backlog Hours" value={`${Math.round(backlogTTB)}h`} sub="to beat all unstarted" />}
            </div>
          </Section>

          {/* ── Status pie chart ── */}
          <Section title="Collection Breakdown">
            <StatusPie byStatus={byStatus} total={total} />
          </Section>

          {/* ── Ownership ── */}
          {!filterStatus || filterStatus === 'all' ? (
            <Section title="Ownership">
              <div className="scard-grid scard-grid--sm">
                <StatCard label="Physical" value={physicalCount} sub={`${pct(physicalCount, total)}%`} />
                <StatCard label="Digital"  value={digitalCount}  sub={`${pct(digitalCount, total)}%`} />
                {untagged > 0 && <StatCard label="Untagged" value={untagged} sub={`${pct(untagged, total)}%`} />}
              </div>
              <div className="ownership-bar-wrap">
                {physicalCount > 0 && (
                  <div className="ownership-bar-seg ownership-bar-seg--physical" style={{ width: `${pct(physicalCount, total)}%` }} title={`Physical: ${physicalCount}`} />
                )}
                {digitalCount > 0 && (
                  <div className="ownership-bar-seg ownership-bar-seg--digital" style={{ width: `${pct(digitalCount, total)}%` }} title={`Digital: ${digitalCount}`} />
                )}
                {untagged > 0 && (
                  <div className="ownership-bar-seg ownership-bar-seg--untagged" style={{ width: `${pct(untagged, total)}%` }} title={`Untagged: ${untagged}`} />
                )}
              </div>
            </Section>
          ) : null}

          {/* ── By system ── */}
          {topSystems.length > 0 && filterSystem === 'all' && (
            <Section title="Games by System">
              <div className="bar-list">
                {topSystems.map(([sys, count]) => (
                  <BarRow key={sys} label={sys} value={count} max={maxSystem} />
                ))}
              </div>
            </Section>
          )}

          {/* ── Completion rate by system ── */}
          {systemCompletion.length > 0 && filterSystem === 'all' && (
            <Section title="Completion Rate by System">
              <div className="bar-list">
                {systemCompletion.map(s => (
                  <div key={s.sys} className="bar-row">
                    <span className="bar-label">{s.sys}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${s.pct}%`, background: 'var(--color-completed)' }} />
                    </div>
                    <span className="bar-value">{s.pct}% <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: '0.72rem' }}>({s.finished}/{s.total})</span></span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── By franchise ── */}
          {topFranchises.length > 0 && filterFranchise === 'all' && (
            <Section title="Franchises">
              <div className="bar-list">
                {topFranchises.map(([f, count]) => (
                  <BarRow key={f} label={f} value={count} max={maxFranchise} color="var(--color-wishlist)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── By genre ── */}
          {topGenres.length > 0 && filterGenre === 'all' && (
            <Section title="Top Genres">
              <div className="bar-list">
                {topGenres.map(([genre, count]) => (
                  <BarRow key={genre} label={genre} value={count} max={maxGenre} color="var(--color-playing)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── By developer ── */}
          {topDevs.length > 0 && (
            <Section title="By Developer">
              <div className="bar-list">
                {topDevs.map(([dev, count]) => (
                  <BarRow key={dev} label={dev} value={count} max={maxDev} color="var(--color-shelved)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Game modes ── */}
          {topModes.length > 0 && (
            <Section title="Game Modes">
              <div className="bar-list">
                {topModes.map(([mode, count]) => (
                  <BarRow key={mode} label={mode} value={count} max={maxMode} color="var(--color-accent)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Player perspectives ── */}
          {topPerspectives.length > 0 && (
            <Section title="Player Perspectives">
              <div className="bar-list">
                {topPerspectives.map(([p, count]) => (
                  <BarRow key={p} label={p} value={count} max={maxPersp} color="var(--color-shelved)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── IGDB Theme Tags ── */}
          {topTags.length > 0 && (
            <Section title="Themes & Tags (IGDB)">
              <div className="bar-list">
                {topTags.map(([tag, count]) => (
                  <BarRow key={tag} label={tag} value={count} max={maxTag} color="var(--color-accent)" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Critic score distribution ── */}
          {withCritic.length > 0 && (
            <Section title="Critic Score Distribution">
              <div className="bar-list">
                {criticBands.filter(b => b.count > 0).map(b => (
                  <BarRow key={b.label} label={b.label} value={b.count} max={maxCriticBand} color={b.color} />
                ))}
              </div>
            </Section>
          )}

          {/* ── Ratings ── */}
          {rated.length > 0 && (
            <Section title="Rating Distribution">
              <div className="bar-list">
                {ratingDist.map(([r, count]) => (
                  <BarRow key={r} label={`${'★'.repeat(r)} (${r})`} value={count} max={maxRating} color="#f59e0b" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Journal highlights ── */}
          {totalEntries > 0 && (
            <Section title="Journal Highlights">
              <div className="journal-highlights">
                {mostJournalled && (
                  <div className="highlight-card">
                    <span className="highlight-icon"><Icon name="journal" size={20} /></span>
                    <div>
                      <p className="highlight-label">Most Journalled</p>
                      <p className="highlight-value">{mostJournalled.title}</p>
                      <p className="highlight-sub">{mostJournalled.count} {mostJournalled.count === 1 ? 'entry' : 'entries'}</p>
                    </div>
                  </div>
                )}
                {latestEntry && (
                  <div className="highlight-card">
                    <span className="highlight-icon"><Icon name="clock" size={20} /></span>
                    <div>
                      <p className="highlight-label">Latest Entry</p>
                      <p className="highlight-value">{latestEntry.gameTitle}</p>
                      <p className="highlight-sub">{(() => { const [y,m,d] = latestEntry.date.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) })()}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}

    </div>
  )
}
