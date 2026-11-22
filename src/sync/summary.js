import { same } from './merge.js'

const MAX_NAMED = 4      // name at most this many games per action before "and N more"
const MAX_FIELDS = 3     // list changed fields only for a single small edit

function listNames(names) {
  if (names.length <= MAX_NAMED) return names.join(', ')
  return `${names.slice(0, MAX_NAMED - 1).join(', ')} and ${names.length - (MAX_NAMED - 1)} more`
}

function changedFields(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter(k => k !== 'id' && !same(a[k], b[k]))
}

/**
 * Describe what changed from `prev` to `next` (each `{ games, journal }`)
 * as a one-line commit message.
 */
export function summarizeChanges(prev, next) {
  const prevById = new Map((prev.games ?? []).map(g => [g.id, g]))
  const nextById = new Map((next.games ?? []).map(g => [g.id, g]))
  const title = id => (nextById.get(id) ?? prevById.get(id))?.title ?? `game ${id}`

  const added   = []
  const edited  = []
  const removed = []
  for (const [id, g] of nextById) {
    const before = prevById.get(id)
    if (!before) added.push(g.title)
    else if (!same(before, g)) edited.push({ title: g.title, fields: changedFields(before, g) })
  }
  for (const [id, g] of prevById) if (!nextById.has(id)) removed.push(g.title)

  const parts = []
  if (edited.length === 1 && edited[0].fields.length && edited[0].fields.length <= MAX_FIELDS) {
    parts.push(`edit ${edited[0].title} (${edited[0].fields.join(', ')})`)
  } else if (edited.length) {
    parts.push(`edit ${listNames(edited.map(e => e.title))}`)
  }
  if (added.length)   parts.push(`add ${listNames(added)}`)
  if (removed.length) parts.push(`remove ${listNames(removed)}`)

  // Journal: count added/removed/edited entries per game (sub-game keys are "id:Title")
  const pj = prev.journal ?? {}, nj = next.journal ?? {}
  const journalNames = []
  for (const key of new Set([...Object.keys(pj), ...Object.keys(nj)])) {
    if (same(pj[key] ?? [], nj[key] ?? [])) continue
    const [idPart, sub] = key.split(/:(.*)/s)
    const id = Number(idPart)
    // Skip journals of removed games; the removal already says it
    if (!nextById.has(id) && prevById.has(id)) continue
    journalNames.push(sub ? sub : title(id))
  }
  if (journalNames.length) parts.push(`journal ${listNames([...new Set(journalNames)])}`)

  if (!parts.length) return 'Update library'
  return `Update library: ${parts.join('; ')}`
}
