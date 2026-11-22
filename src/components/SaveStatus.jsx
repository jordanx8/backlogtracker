const LABELS = {
  saved:        { text: 'Saved',            tone: 'ok' },
  saving:       { text: 'Saving…',          tone: 'busy' },
  unsaved:      { text: 'Unsaved changes',  tone: 'busy' },
  offline:      { text: 'Offline',          tone: 'warn', hint: 'Changes are kept on this device and saved when you are back online.' },
  error:        { text: 'Save failed',      tone: 'warn', hint: 'Changes are kept on this device. Retrying automatically; click to retry now.' },
  unauthorized: { text: 'Signed out',       tone: 'warn' },
}

/** Header indicator for autosave state. Click to retry when something failed. */
export default function SaveStatus({ status, error, onRetry }) {
  const { text, tone, hint } = LABELS[status] ?? LABELS.saved
  const canRetry = status === 'offline' || status === 'error'
  const title = [hint, error].filter(Boolean).join('\n') || 'All changes are saved to GitHub'
  return (
    <button
      type="button"
      className={`save-status save-status--${tone}`}
      title={title}
      onClick={canRetry ? onRetry : undefined}
      aria-live="polite"
      disabled={!canRetry}
    >
      <span className="save-status-dot" aria-hidden="true" />
      {text}
    </button>
  )
}
