/**
 * Three-way merge of the library (games + journal).
 *
 *   base   = what this device last loaded or saved
 *   local  = what this device has now
 *   remote = what is on GitHub now (another device saved in between)
 *
 * Rules (see openspec design "Three-way merge rules"):
 *   - added on one side            → keep
 *   - deleted on one side, other unchanged → delete
 *   - deleted on one side, other modified  → keep the modified version
 *   - modified on both             → per field: one-sided change wins,
 *                                    both-sided change → local wins
 *   - arrays/objects inside a record are compared as whole values
 */

/** Deep equality via stable JSON (key order independent). */
export function same(a, b) {
  return stableStringify(a) === stableStringify(b)
}

function stableStringify(v) {
  if (v === undefined) return 'undefined'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
}

/** Field-level three-way merge of two versions of one record. */
export function mergeRecord(base, local, remote) {
  const out  = {}
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])
  for (const k of keys) {
    const b = base?.[k], l = local[k], r = remote[k]
    let v
    if (same(l, b))      v = r   // only remote changed (or neither)
    else if (same(r, b)) v = l   // only local changed
    else                 v = l   // both changed → local (the device saving now) wins
    if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * Merge three keyed collections of records.
 * @returns {Map<key, record>} merged records (insertion order not meaningful)
 */
function mergeKeyed(baseMap, localMap, remoteMap) {
  const out  = new Map()
  const keys = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()])
  for (const k of keys) {
    const b = baseMap.get(k), l = localMap.get(k), r = remoteMap.get(k)
    if (b === undefined) {
      // Added on one or both sides
      if (l !== undefined && r !== undefined) out.set(k, mergeRecord({}, l, r))
      else out.set(k, l ?? r)
      continue
    }
    if (l === undefined && r === undefined) continue          // deleted on both
    if (l === undefined) { if (!same(r, b)) out.set(k, r); continue }  // deleted locally
    if (r === undefined) { if (!same(l, b)) out.set(k, l); continue }  // deleted remotely
    out.set(k, mergeRecord(b, l, r))
  }
  return out
}

/** Order: remote order first, then anything only in local (in local order). */
function ordered(merged, remoteKeys, localKeys) {
  const out  = []
  const seen = new Set()
  for (const k of [...remoteKeys, ...localKeys]) {
    if (seen.has(k) || !merged.has(k)) continue
    seen.add(k)
    out.push(merged.get(k))
  }
  return out
}

const byId = (arr, keyOf) => new Map((arr ?? []).map(x => [keyOf(x), x]))

const gameKey  = g => g.id
const entryKey = e => (e.id != null ? `id:${e.id}` : `json:${stableStringify(e)}`)

export function mergeGames(base, local, remote) {
  const merged = mergeKeyed(byId(base, gameKey), byId(local, gameKey), byId(remote, gameKey))
  return ordered(merged, (remote ?? []).map(gameKey), (local ?? []).map(gameKey))
}

export function mergeJournal(base, local, remote) {
  base = base ?? {}; local = local ?? {}; remote = remote ?? {}
  const out  = {}
  const keys = [...new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(base)])]
  for (const key of keys) {
    const b = base[key], l = local[key], r = remote[key]
    const merged  = mergeKeyed(byId(b, entryKey), byId(l, entryKey), byId(r, entryKey))
    const entries = ordered(merged, (r ?? []).map(entryKey), (l ?? []).map(entryKey))
    // Keep the key if it has entries, or if both sides still have it (an emptied list)
    if (entries.length || (l !== undefined && r !== undefined)) out[key] = entries
  }
  return out
}

/** Merge the whole library. Each argument is `{ games, journal }`. */
export function mergeLibrary(base, local, remote) {
  return {
    games:   mergeGames(base.games, local.games, remote.games),
    journal: mergeJournal(base.journal, local.journal, remote.journal),
  }
}
