import Icon from './Icon'

// Parse YYYY-MM-DD as a local date (avoids UTC-midnight off-by-one)
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(iso) {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function AllJournal({ games, journal, onDeleteEntry, onOpenJournal }) {
  // Flatten every entry with its parent game attached, then sort newest first
  const allEntries = []
  for (const game of games) {
    for (const entry of (journal[game.id] ?? [])) {
      allEntries.push({ ...entry, game })
    }
  }
  allEntries.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)  // YYYY-MM-DD sorts correctly as strings
    if (dateDiff !== 0) return dateDiff
    return b.id - a.id   // same date → insertion order, newest first
  })

  // Group by date string so we can render date headers
  const groups = []
  let lastDate = null
  for (const entry of allEntries) {
    if (entry.date !== lastDate) {
      groups.push({ date: entry.date, entries: [] })
      lastDate = entry.date
    }
    groups[groups.length - 1].entries.push(entry)
  }

  const totalEntries = allEntries.length

  return (
    <div className="all-journal">
      <div className="all-journal-header">
        <h2 className="all-journal-title">All Journal Entries</h2>
        {totalEntries > 0 && (
          <span className="all-journal-count">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}</span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>No journal entries yet.</p>
          <p className="empty-state-sub">Open any game card and tap the Journal button to get started.</p>
        </div>
      ) : (
        <div className="all-journal-feed">
          {groups.map(group => (
            <div key={group.date} className="journal-day-group">
              <div className="journal-day-header">
                <span className="journal-day-label">{formatDate(group.date)}</span>
              </div>

              {group.entries.map(entry => (
                <div key={entry.id} className="all-journal-entry">
                  <div className="all-journal-entry-game">
                    {entry.game.cover && (
                      <img className="all-journal-thumb" src={entry.game.cover} alt="" loading="lazy" />
                    )}
                    <div className="all-journal-game-info">
                      <button
                        className="all-journal-game-link"
                        onClick={() => onOpenJournal(entry.game)}
                        title="Open game journal"
                      >
                        {entry.game.title}
                      </button>
                      <span className="all-journal-game-system">{entry.game.system}</span>
                    </div>
                  </div>
                  <p className="all-journal-entry-text">{entry.text}</p>
                  <button
                    className="all-journal-delete"
                    title="Delete entry"
                    onClick={() => onDeleteEntry(entry.game.id, entry.id)}
                  ><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
