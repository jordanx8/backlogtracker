/**
 * IGDB access and matching for the "Add game from IGDB" workflow.
 * Runs in Node (GitHub Actions or locally); never in the browser.
 */

import { GENRES } from '../src/constants.js'

// ── IGDB client ───────────────────────────────────────────────────────────────

/**
 * @param {{ clientId: string, clientSecret: string, fetch?: typeof fetch }} opts
 * @returns {{ post: (endpoint: string, body: string) => Promise<any[]> }}
 */
export function createIgdbClient({ clientId, clientSecret, fetch: doFetch = globalThis.fetch }) {
  let token = null

  async function getToken() {
    if (token) return token
    const url = 'https://id.twitch.tv/oauth2/token?' + new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials',
    })
    const res = await doFetch(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Twitch token request failed (${res.status}). Check the IGDB_CLIENT_ID and IGDB_CLIENT_SECRET secrets.`)
    token = (await res.json()).access_token
    return token
  }

  return {
    async post(endpoint, body) {
      const res = await doFetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${await getToken()}`, 'Content-Type': 'text/plain' },
        body,
      })
      if (!res.ok) throw new Error(`IGDB ${endpoint} failed (${res.status}): ${await res.text()}`)
      return res.json()
    },
  }
}

// ── Mapping (IGDB → app values) ──────────────────────────────────────────────

const imgUrl = (imageId, size = 't_cover_big') =>
  `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`

/** App system name → IGDB platform ID, used to limit the search. */
export const PLATFORM_ID_MAP = {
  'PC':               6,
  'PlayStation 5':    167,
  'PlayStation 4':    48,
  'PlayStation 3':    9,
  'PlayStation 2':    8,
  'PlayStation':      7,
  'Xbox Series X/S':  169,
  'Xbox One':         49,
  'Xbox 360':         12,
  'Xbox':             11,
  'Nintendo Switch':  130,
  'Nintendo Switch 2':471,
  'Wii U':            41,
  'Wii':              5,
  'Nintendo 3DS':     37,
  'Nintendo DS':      20,
  'Game Boy Advance': 24,
  'Game Boy Color':   22,
  'Game Boy':         33,
  'GameCube':         21,
  'Nintendo 64':      4,
  'Super Nintendo':   19,
  'NES':              18,
  'Dreamcast':        23,
  'Sega Saturn':      32,
  'Sega Genesis':     29,
  'iOS':              39,
  'Android':          34,
}

const PLATFORM_MAP = {
  'PC (Microsoft Windows)': 'PC',
  'Xbox Series X|S':        'Xbox Series X/S',
  'Nintendo GameCube':      'GameCube',
  'Super Nintendo Entertainment System (SNES)': 'Super Nintendo',
  'Super Nintendo Entertainment System': 'Super Nintendo',
  'Nintendo Entertainment System (NES)':        'NES',
  'Nintendo Entertainment System':              'NES',
  'Sega Mega Drive/Genesis':'Sega Genesis',
}
const mapPlatform = name => PLATFORM_MAP[name] ?? name

const GENRE_MAP = {
  'Role-playing (RPG)':          'RPG',
  'Hack and slash/Beat \'em up': 'Action',
  'Platform':                    'Platformer',
  'Real Time Strategy (RTS)':    'Strategy',
  'Simulator':                   'Simulation',
  'Sport':                       'Sports',
  'Arcade':                      'Action',
  'Point-and-click':             'Adventure',
  'Indie':                       null,  // skip
}
const mapGenre = name => (name in GENRE_MAP ? GENRE_MAP[name] : name)

// IGDB game types to ignore: mods, episodes, seasons (`category` is the older name)
const EXCLUDED_TYPES = new Set([5, 6, 7])
const gameType = g => (typeof g.game_type === 'object' ? g.game_type?.id : g.game_type) ?? g.category

const GAME_FIELDS = `fields name,cover.image_id,first_release_date,genres.name,themes.name,collection.name,
  platforms.name,aggregated_rating,aggregated_rating_count,
  involved_companies.company.name,involved_companies.developer,
  game_modes.name,player_perspectives.name,dlcs.name,expansions.name,category,game_type;`

const quote = s => s.replace(/["\\]/g, '')

export const releaseYear = g =>
  g.first_release_date ? String(new Date(g.first_release_date * 1000).getUTCFullYear()) : null

// ── Matching ─────────────────────────────────────────────────────────────────

const FIRST_PASS_LIMIT = 20
const WIDE_PASS_LIMIT  = 200
const STOP_WORDS = new Set(['the', 'of', 'a', 'an', 'and'])

/** Title comparison key: lower case, punctuation and accents removed. */
export function normalizeTitle(title) {
  return String(title ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Words that must appear in a title for it to count as containing the entered title. */
export function significantWords(title) {
  return [...new Set(normalizeTitle(title).split(' ').filter(w => w && !STOP_WORDS.has(w)))]
}

const isExact = (g, title) => normalizeTitle(g.name) === normalizeTitle(title)

function hasAllWords(g, words) {
  const have = new Set(normalizeTitle(g.name).split(' '))
  return words.length > 0 && words.every(w => have.has(w))
}

/**
 * Order candidates: exact title first, then containing every entered word,
 * then matching release year, then IGDB's own order (stable).
 */
export function rankCandidates(candidates, { title, year }) {
  const words = significantWords(title)
  const score = g =>
    (isExact(g, title) ? 4 : 0) +
    (hasAllWords(g, words) ? 2 : 0) +
    (year && releaseYear(g) === String(year) ? 1 : 0)
  return candidates
    .map((g, i) => ({ g, i, s: score(g) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.g)
}

/**
 * The confident match among ranked candidates, or null:
 *   - an exact title (release year, then IGDB order, decide between several), or
 *   - the only candidate containing every entered word (narrowed by year if given).
 */
export function confidentMatch(ranked, { title, year }) {
  const exact = ranked.filter(g => isExact(g, title))
  if (exact.length) return exact[0]

  const words = significantWords(title)
  let containing = ranked.filter(g => hasAllWords(g, words))
  if (year && containing.length > 1) {
    const sameYear = containing.filter(g => releaseYear(g) === String(year))
    if (sameYear.length) containing = sameYear
  }
  return containing.length === 1 ? containing[0] : null
}

const platformClause = platformId => (platformId ? `platforms = (${platformId})` : '')
const keep = data => data.filter(g => !EXCLUDED_TYPES.has(gameType(g)))

async function textSearch(igdb, title, platformId, limit) {
  const where = platformClause(platformId)
  return keep(await igdb.post('games', `${GAME_FIELDS} search "${quote(title)}"; ${where ? `where ${where}; ` : ''}limit ${limit};`))
}

/** Games whose name contains every significant word (case-insensitive). */
async function wordSearch(igdb, title, platformId, limit) {
  const words = significantWords(title).slice(0, 5)
  if (!words.length) return []
  const clauses = [...words.map(w => `name ~ *"${quote(w)}"*`), platformClause(platformId)].filter(Boolean)
  return keep(await igdb.post('games', `${GAME_FIELDS} where ${clauses.join(' & ')}; limit ${limit};`))
}

function unique(lists) {
  const seen = new Set()
  return lists.flat().filter(g => (seen.has(g.id) ? false : (seen.add(g.id), true)))
}

/**
 * Find the IGDB game for what the owner entered. Every query is limited to
 * the chosen system's IGDB platform (unfiltered only for systems IGDB doesn't
 * know, like "Other"). A first search of 20 results is widened to 200 results
 * plus a every-word name search when it has no confident match.
 * @returns {Promise<{ match: object|null, candidates: object[], searched: string, widened: boolean }>}
 *   `match` is null when nothing confident was found; `candidates` are the
 *   closest results (to show the owner), best first.
 */
export async function findMatch(igdb, { title, system, year, igdbId }) {
  if (igdbId) {
    const [g] = await igdb.post('games', `${GAME_FIELDS} where id = ${Number(igdbId)};`)
    return { match: g ?? null, candidates: g ? [g] : [], searched: `IGDB ID ${igdbId}`, widened: false }
  }

  const platformId = PLATFORM_ID_MAP[system] ?? null
  const searched   = platformId ? `"${title}" on ${system}` : `"${title}" (any system: ${system} isn't an IGDB platform)`

  const first = rankCandidates(await textSearch(igdb, title, platformId, FIRST_PASS_LIMIT), { title, year })
  const firstMatch = confidentMatch(first, { title, year })
  if (firstMatch) return { match: firstMatch, candidates: first, searched, widened: false }

  const [wideText, byWords] = await Promise.all([
    textSearch(igdb, title, platformId, WIDE_PASS_LIMIT),
    wordSearch(igdb, title, platformId, WIDE_PASS_LIMIT),
  ])
  const wide = rankCandidates(unique([first, wideText, byWords]), { title, year })
  return { match: confidentMatch(wide, { title, year }), candidates: wide, searched, widened: true }
}

// ── Details ──────────────────────────────────────────────────────────────────

/** Main-story hours from IGDB (seconds → hours, 1 decimal), or null. */
export async function getTimeToBeat(igdb, igdbId) {
  const data = await igdb.post('game_time_to_beats', `fields normally,hastily,completely; where game_id = ${igdbId};`)
  const secs = data[0]?.normally ?? data[0]?.hastily ?? null
  return secs ? Math.round(secs / 360) / 10 : null
}

/** Titles of the games inside a bundle/compilation, oldest first. */
export async function getBundledGames(igdb, igdbId) {
  const data = await igdb.post('games', `fields name,first_release_date; where bundles = (${igdbId}); limit 50;`)
  return data
    .sort((a, b) => (a.first_release_date && b.first_release_date
      ? a.first_release_date - b.first_release_date
      : a.name.localeCompare(b.name)))
    .map(g => g.name)
}

/**
 * The library fields IGDB provides for a game.
 * @param {object} g  IGDB game (with GAME_FIELDS)
 * @param {{ timeToBeat?: number|null, bundled?: string[] }} extra
 */
export function igdbFields(g, { timeToBeat = null, bundled = [] } = {}) {
  const genres = (g.genres ?? []).map(x => mapGenre(x.name)).filter(Boolean)
  const developer = (g.involved_companies ?? []).filter(ic => ic.developer).map(ic => ic.company?.name).filter(Boolean)[0] ?? null
  const dlc = [...(g.dlcs ?? []), ...(g.expansions ?? [])]
    .filter(d => d.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(d => d.name)

  return {
    igdbId:       g.id,
    title:        g.name,
    cover:        g.cover?.image_id ? imgUrl(g.cover.image_id) : '',
    released:     releaseYear(g) ?? '',
    genre:        GENRES.find(x => genres.includes(x)) ?? genres[0] ?? '',
    franchise:    g.collection?.name ?? '',
    developer:    developer ?? undefined,
    criticScore:  g.aggregated_rating_count >= 3 ? Math.round(g.aggregated_rating) : undefined,
    gameModes:    (g.game_modes ?? []).map(m => m.name).filter(Boolean),
    perspectives: (g.player_perspectives ?? []).map(p => p.name).filter(Boolean),
    tags:         (g.themes ?? []).map(t => t.name).filter(Boolean),
    dlc,
    bundled,
    timeToBeat,
    platforms:    (g.platforms ?? []).map(p => mapPlatform(p.name)),
  }
}

/** One-line description of a candidate for summaries. */
export function describe(g) {
  const platforms = (g.platforms ?? []).map(p => mapPlatform(p.name)).slice(0, 4).join(', ')
  return `${g.name} (${releaseYear(g) ?? 'year unknown'}) · IGDB ID ${g.id}${platforms ? ` · ${platforms}` : ''}`
}
