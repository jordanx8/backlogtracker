import { config } from '../config'
import { getToken } from './auth'

// ── Image URL helpers ─────────────────────────────────────────────────────────
// IGDB image sizes: t_thumb, t_cover_small, t_cover_big, t_screenshot_med,
//                   t_screenshot_big, t_1080p, t_original
const imgUrl = (imageId, size = 't_cover_big') =>
  `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`

// ── Proxy call ────────────────────────────────────────────────────────────────
// IGDB is reached through the owner-only proxy (proxy/), which holds the IGDB
// credentials. It is authorised with the same GitHub token the app signs in with.
async function igdbPost(endpoint, body) {
  if (!config.proxyUrl) throw new Error('IGDB lookup is not configured')
  const name = endpoint.replace(/^\/v4\//, '')
  const res = await fetch(`${config.proxyUrl}/igdb/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken() ?? ''}`,
      'Content-Type':  'text/plain',
    },
    body,
  })
  if (!res.ok) throw new Error(`IGDB ${endpoint} failed: ${res.status}`)
  return res.json()
}

// ── Platform name → IGDB numeric ID ──────────────────────────────────────────
// Used to add a platform filter to search queries when a system is pre-selected.
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

// ── Platform name mapping ─────────────────────────────────────────────────────
const PLATFORM_MAP = {
  'PC (Microsoft Windows)': 'PC',
  'PlayStation 5':          'PlayStation 5',
  'PlayStation 4':          'PlayStation 4',
  'PlayStation 3':          'PlayStation 3',
  'PlayStation 2':          'PlayStation 2',
  'PlayStation':            'PlayStation',
  'Xbox Series X|S':        'Xbox Series X/S',
  'Xbox One':               'Xbox One',
  'Xbox 360':               'Xbox 360',
  'Xbox':                   'Xbox',
  'Nintendo Switch':        'Nintendo Switch',
  'Nintendo Switch 2':      'Nintendo Switch 2',
  'Wii U':                  'Wii U',
  'Wii':                    'Wii',
  'Nintendo 3DS':           'Nintendo 3DS',
  'Nintendo DS':            'Nintendo DS',
  'Game Boy Advance':       'Game Boy Advance',
  'Game Boy Color':         'Game Boy Color',
  'Game Boy':               'Game Boy',
  'Nintendo GameCube':      'GameCube',
  'Nintendo 64':            'Nintendo 64',
  'Super Nintendo Entertainment System (SNES)': 'Super Nintendo',
  'Nintendo Entertainment System (NES)':        'NES',
  'Dreamcast':              'Dreamcast',
  'Sega Saturn':            'Sega Saturn',
  'Sega Mega Drive/Genesis':'Sega Genesis',
  'iOS':                    'iOS',
  'Android':                'Android',
  'Mac':                    'Mac',
  'Linux':                  'Linux',
}

function mapPlatform(name) {
  return PLATFORM_MAP[name] ?? name
}

// ── Genre mapping (IGDB → app labels) ────────────────────────────────────────
const GENRE_MAP = {
  'Role-playing (RPG)':        'RPG',
  'Hack and slash/Beat \'em up': 'Action',
  'Fighting':                  'Fighting',
  'Shooter':                   'Shooter',
  'Adventure':                 'Adventure',
  'Platform':                  'Platformer',
  'Racing':                    'Racing',
  'Real Time Strategy (RTS)':  'Strategy',
  'Strategy':                  'Strategy',
  'Simulator':                 'Simulation',
  'Sport':                     'Sports',
  'Puzzle':                    'Puzzle',
  'Arcade':                    'Action',
  'Visual Novel':              'Visual Novel',
  'Point-and-click':           'Adventure',
  'Indie':                     null,  // skip
}

function mapGenre(name) {
  if (name in GENRE_MAP) return GENRE_MAP[name]
  return name
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch time-to-beat from IGDB for a given game ID.
 * Returns the "normally" (main story) time in hours, rounded to 1 decimal.
 * Falls back to "hastily" if normally is missing.  Returns null if not found.
 * IGDB stores these in seconds.
 */
export async function getTimeToBeat(igdbId) {
  const data = await igdbPost('/v4/game_time_to_beats',
    `fields normally,hastily,completely; where game_id = ${igdbId};`
  )
  if (!data.length) return null
  const secs = data[0].normally ?? data[0].hastily ?? null
  if (!secs) return null
  return Math.round(secs / 360) / 10  // seconds → hours, 1 decimal
}

/**
 * Enrich a single game by title — returns a patch object with IGDB-sourced
 * fields (genre, franchise, tags, timeToBeat, developer, criticScore,
 * gameModes, perspectives, dlc, cover, released).
 * Returns null on no match.
 */
export async function enrichGame(title) {
  if (!title?.trim()) return null

  const data = await igdbPost('/v4/games',
    `fields name,cover.image_id,first_release_date,genres.name,themes.name,collection.name,
            aggregated_rating,aggregated_rating_count,
            involved_companies.company.name,involved_companies.developer,
            game_modes.name,player_perspectives.name,
            dlcs.name,expansions.name;
     search "${title.replace(/"/g, '')}";
     limit 1;
     where version_parent = null;`
  )
  if (!data.length) return null

  const g = data[0]

  const genres = (g.genres ?? [])
    .map(ge => mapGenre(ge.name))
    .filter(Boolean)

  const tags = (g.themes ?? [])
    .map(t => t.name)
    .filter(Boolean)

  const developer = (g.involved_companies ?? [])
    .filter(ic => ic.developer)
    .map(ic => ic.company?.name)
    .filter(Boolean)[0] ?? null

  const criticScore = g.aggregated_rating_count >= 3
    ? Math.round(g.aggregated_rating)
    : null

  const gameModes = (g.game_modes ?? []).map(m => m.name).filter(Boolean)
  const perspectives = (g.player_perspectives ?? []).map(p => p.name).filter(Boolean)

  const dlc = [
    ...(g.dlcs ?? []),
    ...(g.expansions ?? []),
  ]
    .filter(d => d.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(d => ({ title: d.name, done: false }))

  // Time-to-beat comes from IGDB only
  const timeToBeat = await getTimeToBeat(g.id).catch(() => null)

  return {
    igdbId:       g.id,
    genre:        genres[0] ?? null,
    franchise:    g.collection?.name ?? null,
    tags,
    timeToBeat,
    developer,
    criticScore,
    gameModes,
    perspectives,
    dlc:          dlc.length ? dlc : null,
    cover:        g.cover?.image_id ? imgUrl(g.cover.image_id, 't_cover_big') : null,
    released:     g.first_release_date
      ? new Date(g.first_release_date * 1000).getFullYear().toString()
      : null,
  }
}

/**
 * Search IGDB for games by title, with an optional platform ID filter.
 * Returns results with igdbId, title, cover, released, platforms, genres.
 */
export async function searchGames(query, platformId = null) {
  if (!query.trim()) return []

  const platformWhere = platformId ? `where platforms = (${platformId});` : ''

  const data = await igdbPost('/v4/games',
    `fields name,cover.image_id,first_release_date,genres.name,platforms.name,bundles.name,
            collection.name,aggregated_rating,aggregated_rating_count,
            involved_companies.company.name,involved_companies.developer,
            game_modes.name,player_perspectives.name,dlcs.name,expansions.name,category;
     search "${query.replace(/"/g, '')}";
     limit 15;
     ${platformWhere}`
  )

  // Exclude pure mods (category 5), episodes (6), seasons (7) — keep everything else
  // including versions/complete editions (which have version_parent set)
  const EXCLUDE_CATEGORIES = new Set([5, 6, 7])
  const filtered = data.filter(g => !EXCLUDE_CATEGORIES.has(g.category))

  return filtered.map(g => {
    const year = g.first_release_date
      ? new Date(g.first_release_date * 1000).getFullYear().toString()
      : null

    const platforms = (g.platforms ?? []).map(p => mapPlatform(p.name))

    const genres = (g.genres ?? [])
      .map(ge => mapGenre(ge.name))
      .filter(Boolean)

    const developer = (g.involved_companies ?? [])
      .filter(ic => ic.developer)
      .map(ic => ic.company?.name)
      .filter(Boolean)[0] ?? null

    const criticScore = g.aggregated_rating_count >= 3
      ? Math.round(g.aggregated_rating)
      : null

    const gameModes = (g.game_modes ?? []).map(m => m.name).filter(Boolean)
    const perspectives = (g.player_perspectives ?? []).map(p => p.name).filter(Boolean)

    const dlc = [
      ...(g.dlcs ?? []),
      ...(g.expansions ?? []),
    ]
      .filter(d => d.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => ({ title: d.name, done: false }))

    return {
      igdbId:       g.id,
      title:        g.name,
      cover:        g.cover?.image_id ? imgUrl(g.cover.image_id, 't_cover_big') : null,
      released:     year,
      platforms,
      genres,
      franchise:    g.collection?.name ?? null,
      developer,
      criticScore,
      gameModes,
      perspectives,
      dlc:          dlc.length ? dlc : null,
    }
  })
}

/**
 * Fetch the list of games bundled inside a compilation/collection.
 * IGDB models this as: child games have a `bundles` array pointing to the
 * bundle game's ID.  So we query games where bundles contains igdbId and
 * return their names sorted by release date.
 * Returns [] when the game is not a bundle / has no bundled contents.
 */
export async function getBundledGames(igdbId) {
  const data = await igdbPost('/v4/games',
    `fields name,first_release_date;
     where bundles = (${igdbId});
     limit 50;`
  )
  if (!data.length) return []
  // Sort by release date ascending (oldest first), fall back to name order
  return data
    .sort((a, b) => {
      if (a.first_release_date && b.first_release_date)
        return a.first_release_date - b.first_release_date
      return a.name.localeCompare(b.name)
    })
    .map(g => g.name)
}

/**
 * Fetch screenshots for a given IGDB game ID.
 * Returns an array of full-resolution image URLs.
 */
export async function getGameImages(igdbId) {
  const data = await igdbPost('/v4/screenshots',
    `fields image_id; where game = ${igdbId}; limit 12;`
  )
  return data.map(s => imgUrl(s.image_id, 't_screenshot_big'))
}
