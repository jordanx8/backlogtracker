import { useState } from 'react'
import Icon from './Icon'

// Parse YYYY-MM-DD as a local date (avoids UTC-midnight off-by-one)
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(iso) {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

// Returns today's date as YYYY-MM-DD in the user's local timezone
function localToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function GameJournal({ game, subGame, entries, onAddEntry, onDeleteEntry, onClose }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(localToday)
  const [error, setError] = useState('')

  // Journal key: compound for sub-games, plain id for the parent game
  const journalKey = subGame ? `${game.id}:${subGame}` : game.id

  const handleAdd = () => {
    if (!text.trim()) { setError('Entry text is required'); return }
    onAddEntry(journalKey, { id: Date.now(), date, text: text.trim() })
    setText('')
    setError('')
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--journal">
        <div className="modal-header">
          <div>
            <h2><Icon name="journal" size={18} /> Journal</h2>
            <p className="journal-game-title">
              {subGame ? (
                <>
                  <span className="journal-parent-title">{game.title}</span>
                  <span className="journal-sub-separator"> › </span>
                  {subGame}
                </>
              ) : game.title}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <div className="journal-compose">
          <div className="field-row">
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>What did you do today?</label>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setError('') }}
              placeholder="e.g. Beat the first boss, explored the northern region..."
              rows={3}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
          <div className="journal-compose-footer">
            <button className="btn-primary" onClick={handleAdd}>Add Entry</button>
          </div>
        </div>

        <div className="journal-entries">
          {sorted.length === 0 ? (
            <p className="journal-empty">No entries yet. Add your first one above!</p>
          ) : (
            sorted.map(entry => (
              <div key={entry.id} className="journal-entry">
                <div className="journal-entry-header">
                  <span className="journal-entry-date">{formatDate(entry.date)}</span>
                  <button
                    className="icon-btn icon-btn--sm"
                    title="Delete entry"
                    onClick={() => onDeleteEntry(journalKey, entry.id)}
                  ><Icon name="trash" size={14} /></button>
                </div>
                <p className="journal-entry-text">{entry.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
