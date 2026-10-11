import { useState } from 'react'
import Icon from './Icon'

const STATUS_LABELS  = { playing: 'Playing', backlog: 'Not Started', completed: 'Completed', shelved: 'Shelved', wishlist: 'Wishlist' }
const OWNERSHIP_ICON  = { physical: <Icon name="physical" size={13} />, digital: <Icon name="digital" size={13} />, both: <><Icon name="physical" size={13} /><Icon name="digital" size={13} /></> }
const OWNERSHIP_LABEL = { physical: 'Physical', digital: 'Digital', both: 'Physical + Digital' }
const STARS = [1, 2, 3, 4, 5]

function CriticScore({ score }) {
  const color = score >= 75 ? 'var(--color-completed)'
              : score >= 50 ? 'var(--color-playing)'
              : 'var(--color-backlog)'
  return (
    <span className="critic-score" style={{ borderColor: color, color }} title="Critic score (IGDB)">
      {score}
    </span>
  )
}

function ChecklistSection({ label, items, onToggle, gameId }) {
  const [open, setOpen] = useState(false)
  if (!items?.length) return null
  const doneCount = items.filter(i => i.done).length
  return (
    <div className="included-games">
      <button className="included-games-toggle" onClick={() => setOpen(o => !o)} type="button">
        <span className="included-games-icon">{open ? '▾' : '▸'}</span>
        {label} · {items.length}
        <span className="included-progress">{doneCount}/{items.length}</span>
      </button>
      {open && (
        <ul className="included-games-list">
          {items.map((item, i) => (
            <li key={i} className={item.done ? 'included-item--done' : ''}>
              <label className="included-item">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggle?.(gameId, i)}
                />
                <span>{item.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function GameCard({ game, onEdit, onDelete, onOpenJournal, onToggleIncluded, onToggleDlc }) {
  const entryWord = game.journalCount === 1 ? 'entry' : 'entries'
  const [showIncluded, setShowIncluded] = useState(false)
  const hasIncluded = Array.isArray(game.includedGames) && game.includedGames.length > 0

  // Normalise includedGames to {title, done}[]
  const includedNorm = hasIncluded
    ? game.includedGames.map(g => typeof g === 'string' ? { title: g, done: false } : g)
    : []
  const doneCount = includedNorm.filter(g => g.done).length

  return (
    <div className={`game-card status-${game.status}`}>
      <div className="card-body">
        <div className="card-header">
          <div className="card-header-left">
            {game.cover && (
              <div className="card-cover-wrap">
                <img className="card-cover" src={game.cover} alt={game.title} loading="lazy" />
              </div>
            )}
            <span className={`status-badge status-badge--${game.status}`}>
              {STATUS_LABELS[game.status]}
            </span>
          </div>
          <div className="card-actions">
            {game.criticScore != null && <CriticScore score={game.criticScore} />}
            <button className="icon-btn" title="Edit" onClick={() => onEdit(game)}><Icon name="edit" size={14} /></button>
            <button className="icon-btn" title="Delete" onClick={() => onDelete(game.id)}><Icon name="trash" size={14} /></button>
          </div>
        </div>

        <h2 className="card-title">{game.title}</h2>

        <div className="card-meta-row">
          <p className="card-system">{game.system}</p>
          {game.released && <p className="card-released">{game.released}</p>}
          {game.ownership && (
            <span className="ownership-badge" title={OWNERSHIP_LABEL[game.ownership]}>
              {OWNERSHIP_ICON[game.ownership]}
            </span>
          )}
        </div>

        {game.developer && (
          <p className="card-developer"><Icon name="building" size={12} /> {game.developer}</p>
        )}

        {game.franchise && (
          <p className="card-franchise"><Icon name="books" size={12} /> {game.franchise}</p>
        )}

        <div className="card-tags-row">
          {game.genre && <span className="card-tag">{game.genre}</span>}
          {game.timeToBeat && <span className="card-tag card-tag--time"><Icon name="timer" size={11} /> {game.timeToBeat}h</span>}
          {(game.gameModes ?? []).map(m => (
            <span key={m} className="card-tag card-tag--mode">{m}</span>
          ))}
          {(game.perspectives ?? []).map(p => (
            <span key={p} className="card-tag card-tag--perspective">{p}</span>
          ))}
        </div>

        {game.rating && (
          <div className="card-rating">
            {STARS.map(s => (
              <span key={s} className={s <= game.rating ? 'star star--filled' : 'star'}>
                <Icon name="star" size={12} />
              </span>
            ))}
          </div>
        )}

        {game.notes && <p className="card-notes">{game.notes}</p>}

        {hasIncluded && (
          <div className="included-games">
            <button
              className="included-games-toggle"
              onClick={() => setShowIncluded(s => !s)}
              type="button"
            >
              <span className="included-games-icon">{showIncluded ? '▾' : '▸'}</span>
              {includedNorm.length} game{includedNorm.length !== 1 ? 's' : ''} inside
              <span className="included-progress">
                {doneCount}/{includedNorm.length}
              </span>
            </button>
            {showIncluded && (
              <ul className="included-games-list">
                {includedNorm.map((item, i) => (
                  <li key={i} className={item.done ? 'included-item--done' : ''}>
                    <label className="included-item">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => onToggleIncluded?.(game.id, i)}
                      />
                      <span>{item.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ChecklistSection
          label="DLC / Expansions"
          items={game.dlc}
          onToggle={onToggleDlc}
          gameId={game.id}
        />

        {game.status !== 'wishlist' && (
          <button className="journal-btn" onClick={() => onOpenJournal(game)}>
            <Icon name="journal" size={13} /> Journal
            {game.journalCount > 0 && (
              <span className="journal-count">{game.journalCount} {entryWord}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
