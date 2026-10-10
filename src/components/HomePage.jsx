import Icon from './Icon'

const STARS = [1, 2, 3, 4, 5]

// Parse YYYY-MM-DD as a local date (avoids UTC-midnight off-by-one)
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(iso) {
  const d = parseLocalDate(iso)
  const now = new Date()
  // Compare calendar days in local time
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((todayStart - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Collection pie chart ──────────────────────────────────────────────────────
function CollectionPie({ games }) {
  const owned     = games.filter(g => g.status !== 'wishlist')
  const total     = owned.length
  if (total === 0) return null

  const completed = owned.filter(g => g.status === 'completed').length
  const shelved   = owned.filter(g => g.status === 'shelved').length
  const playing   = owned.filter(g => g.status === 'playing').length
  const backlog   = owned.filter(g => g.status === 'backlog').length
  const backlogTTB = owned
    .filter(g => g.status === 'backlog' && g.timeToBeat)
    .reduce((s, g) => s + g.timeToBeat, 0)

  // Build SVG pie slices from a cx=50 cy=50 r=40 circle
  const R = 40, CX = 50, CY = 50
  const slices = [
    { value: completed, color: 'var(--color-completed)', label: 'Completed' },
    { value: shelved,   color: 'var(--color-shelved)',   label: 'Shelved' },
    { value: playing,   color: 'var(--color-playing)',   label: 'Playing' },
    { value: backlog,   color: 'var(--color-backlog)',   label: 'Not Started' },
  ].filter(s => s.value > 0)

  const toRad = (deg) => (deg - 90) * (Math.PI / 180)
  let startAngle = 0
  const paths = slices.map(slice => {
    const angle = (slice.value / total) * 360
    const endAngle = startAngle + angle
    const large = angle > 180 ? 1 : 0
    const x1 = CX + R * Math.cos(toRad(startAngle))
    const y1 = CY + R * Math.sin(toRad(startAngle))
    const x2 = CX + R * Math.cos(toRad(endAngle))
    const y2 = CY + R * Math.sin(toRad(endAngle))
    const d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
    const result = { ...slice, d }
    startAngle = endAngle
    return result
  })

  const pct = Math.round(((completed + shelved) / total) * 100)

  return (
    <section className="home-section">
      <h3 className="home-section-title"><Icon name="stats" size={15} /> Collection Progress</h3>
      <div className="pie-wrap">
        <svg viewBox="0 0 100 100" className="pie-svg">
          {total === 1
            ? <circle cx={CX} cy={CY} r={R} fill={slices[0]?.color ?? 'var(--color-border)'} />
            : paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)
          }
          <circle cx={CX} cy={CY} r={26} fill="var(--color-surface)" />
          <text x={CX} y={CY - 4} textAnchor="middle" className="pie-center-pct">{pct}%</text>
          <text x={CX} y={CY + 10} textAnchor="middle" className="pie-center-label">done</text>
        </svg>
        <div className="pie-legend">
          {[
            { label: 'Completed',   value: completed, color: 'var(--color-completed)' },
            { label: 'Shelved',     value: shelved,   color: 'var(--color-shelved)' },
            { label: 'Playing',     value: playing,   color: 'var(--color-playing)' },
            { label: 'Not Started', value: backlog,   color: 'var(--color-backlog)' },
          ].filter(e => e.value > 0).map(({ label, value, color }) => (
            <div key={label} className="pie-legend-row">
              <span className="pie-legend-dot" style={{ background: color }} />
              <span className="pie-legend-label">{label}</span>
              <span className="pie-legend-value">{value}</span>
            </div>
          ))}
          {backlogTTB > 0 && (
            <p className="pie-ttb"><Icon name="timer" size={12} /> <strong>{Math.round(backlogTTB)}h</strong> left in backlog</p>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Main HomePage ─────────────────────────────────────────────────────────────
export default function HomePage({ games, journal, onOpenJournal, onOpenGame, counts }) {
  const playing = games.filter(g => g.status === 'playing')
  const wishlist = games.filter(g => g.status === 'wishlist').slice(0, 4)

  // Up next by time-to-beat (shortest first; games without TTB go last)
  const upNextByTime = games
    .filter(g => g.status === 'backlog')
    .sort((a, b) => (a.timeToBeat ?? Infinity) - (b.timeToBeat ?? Infinity))
    .slice(0, 6)

  // Recent journal entries across all games, last 8
  const recentEntries = []
  for (const game of games) {
    for (const entry of (journal[game.id] ?? [])) {
      recentEntries.push({ ...entry, game })
    }
  }
  recentEntries.sort((a, b) => {
    const dd = b.date.localeCompare(a.date)
    return dd !== 0 ? dd : b.id - a.id
  })
  const recent = recentEntries.slice(0, 8)

  return (
    <div className="home-page">

      {/* ── Summary pills ── */}
      <div className="home-summary">
        <SummaryPill icon={<Icon name="gamepad" size={16} />} label="Total"   value={counts.all}       />
        <SummaryPill icon={<Icon name="play"    size={16} />} label="Playing" value={counts.playing}   color="var(--color-playing)" />
        <SummaryPill icon={<Icon name="archive" size={16} />} label="Backlog" value={counts.backlog}   color="var(--color-backlog)" />
        <SummaryPill icon={<Icon name="check"   size={16} />} label="Done"    value={counts.completed} color="var(--color-completed)" />
        {counts.shelved > 0 && <SummaryPill icon={<Icon name="archive" size={16} />} label="Shelved" value={counts.shelved} color="var(--color-shelved)" />}
        <SummaryPill icon={<Icon name="wishlist" size={16} />} label="Wishlist" value={counts.wishlist} color="var(--color-wishlist)" />
      </div>

      <div className="home-columns">
        <div className="home-col-main">

          {/* ── Currently playing ── */}
          <section className="home-section">
            <h3 className="home-section-title"><Icon name="play" size={15} /> Currently Playing</h3>
            {playing.length === 0 ? (
              <p className="home-empty">Nothing in progress — pick something from your backlog!</p>
            ) : (
              <div className="playing-list">
                {playing.map(game => (
                  <div
                    key={game.id}
                    className="playing-card"
                    onClick={() => onOpenGame(game)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onOpenGame(game)}
                  >
                    {game.cover && <img className="playing-cover" src={game.cover} alt="" loading="lazy" />}
                    <div className="playing-info">
                      <p className="playing-title">{game.title}</p>
                      <p className="playing-meta">
                        {game.system}
                        {game.genre ? ` · ${game.genre}` : ''}
                        {game.timeToBeat ? <> · <Icon name="timer" size={11} /> {game.timeToBeat}h</> : ''}
                      </p>
                      {game.franchise && <p className="playing-franchise"><Icon name="books" size={12} /> {game.franchise}</p>}
                      {game.rating && (
                        <div className="playing-rating">
                          {STARS.map(s => (
                            <span key={s} className={s <= game.rating ? 'star star--filled' : 'star'}>
                              <Icon name="star" size={12} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="playing-journal-btn"
                      onClick={e => { e.stopPropagation(); onOpenJournal(game) }}
                      title="Open journal"
                    ><Icon name="journal" size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Recent journal ── */}
          <section className="home-section">
            <h3 className="home-section-title"><Icon name="journal" size={15} /> Recent Journal Entries</h3>
            {recent.length === 0 ? (
              <p className="home-empty">No journal entries yet — open a game and start writing!</p>
            ) : (
              <div className="recent-entries">
                {recent.map(entry => (
                  <div key={entry.id} className="recent-entry">
                    <div className="recent-entry-header">
                      <button className="recent-entry-game" onClick={() => onOpenJournal(entry.game)}>
                        {entry.game.cover && (
                          <img className="recent-entry-thumb" src={entry.game.cover} alt="" loading="lazy" />
                        )}
                        <span>{entry.game.title}</span>
                      </button>
                      <span className="recent-entry-date">{formatDate(entry.date)}</span>
                    </div>
                    <p className="recent-entry-text">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        <div className="home-col-side">

          {/* ── Up next by time ── */}
          <section className="home-section">
            <h3 className="home-section-title"><Icon name="lightning" size={15} /> Quickest to Beat</h3>
            {upNextByTime.length === 0 ? (
              <p className="home-empty">Backlog is empty!</p>
            ) : (
              <div className="side-list">
                {upNextByTime.map(game => (
                  <SideGameRow key={game.id} game={game} onClick={() => onOpenGame(game)} />
                ))}
              </div>
            )}
          </section>

          {/* ── Wishlist preview ── */}
          {wishlist.length > 0 && (
            <section className="home-section">
              <h3 className="home-section-title"><Icon name="wishlist" size={15} /> Wishlist</h3>
              <div className="side-list">
                {wishlist.map(game => (
                  <SideGameRow key={game.id} game={game} onClick={() => onOpenGame(game)} />
                ))}
              </div>
            </section>
          )}

          {/* ── Collection pie chart ── */}
          <CollectionPie games={games} />

        </div>
      </div>
    </div>
  )
}

function SummaryPill({ icon, label, value, color }) {
  return (
    <div className="home-pill">
      <span className="home-pill-icon">{icon}</span>
      <span className="home-pill-value" style={color ? { color } : {}}>{value}</span>
      <span className="home-pill-label">{label}</span>
    </div>
  )
}

function SideGameRow({ game, onClick }) {
  return (
    <button className="side-game-row" onClick={onClick}>
      {game.cover
        ? <img className="side-game-thumb" src={game.cover} alt="" loading="lazy" />
        : <div className="side-game-thumb side-game-thumb--placeholder"><Icon name="gamepad" size={20} /></div>
      }
      <div className="side-game-info">
        <p className="side-game-title">{game.title}</p>
        <p className="side-game-meta">
          {game.system}
          {game.timeToBeat ? <> · <Icon name="timer" size={11} /> {game.timeToBeat}h</> : ''}
        </p>
      </div>
    </button>
  )
}
