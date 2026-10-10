import { useState } from 'react'
import Icon from './Icon'

export default function RandomPicker({ games, onClose, onEdit }) {
  const pool = games.filter(g => g.status === 'backlog')
  const [picked, setPicked] = useState(null)
  const [spinning, setSpinning] = useState(false)

  const pick = () => {
    if (!pool.length) return
    setSpinning(true)
    setPicked(null)
    // Short fake spin for fun
    let ticks = 0
    const interval = setInterval(() => {
      setPicked(pool[Math.floor(Math.random() * pool.length)])
      ticks++
      if (ticks >= 12) {
        clearInterval(interval)
        setSpinning(false)
        setPicked(pool[Math.floor(Math.random() * pool.length)])
      }
    }, 80)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--picker">
        <div className="modal-header">
          <h2><Icon name="dice" size={18} /> Random Picker</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <div className="picker-body">
          {pool.length === 0 ? (
            <p className="picker-empty">No unstarted games in your collection to pick from!</p>
          ) : (
            <>
              <p className="picker-sub">
                {pool.length} unstarted {pool.length === 1 ? 'game' : 'games'} in your backlog
              </p>

              <div className={`picker-result ${spinning ? 'picker-result--spinning' : ''} ${picked && !spinning ? 'picker-result--shown' : ''}`}>
                {picked ? (
                  <>
                    {picked.cover && (
                      <img className="picker-cover" src={picked.cover} alt={picked.title} />
                    )}
                    <div className="picker-game-info">
                      <p className="picker-game-title">{picked.title}</p>
                      <p className="picker-game-meta">
                        {picked.system}
                        {picked.genre ? ` · ${picked.genre}` : ''}
                        {picked.timeToBeat ? <> · <Icon name="timer" size={11} /> {picked.timeToBeat}h</> : ''}
                      </p>
                      {picked.franchise && (
                        <p className="picker-game-franchise"><Icon name="books" size={12} /> {picked.franchise}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="picker-placeholder">Hit the button!</p>
                )}
              </div>

              <div className="picker-actions">
                <button className="btn-primary picker-btn" onClick={pick} disabled={spinning}>
                  {spinning ? 'Picking…' : picked ? <><Icon name="dice" size={14} /> Pick Again</> : <><Icon name="dice" size={14} /> Pick a Game</>}
                </button>
                {picked && !spinning && (
                  <button className="btn-secondary" onClick={() => { onEdit(picked); onClose() }}>
                    <Icon name="edit" size={13} /> Edit Game
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
