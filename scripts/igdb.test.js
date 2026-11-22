import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMatch, resolvePlatform, rankCandidates, normalizeTitle, significantWords, igdbFields, getTimeToBeat, PLATFORM_ID_MAP, IGDB_PLATFORM_NAMES } from './igdb.js'
import { SYSTEMS } from '../src/constants.js'

const ts = year => Date.UTC(year, 5, 1) / 1000
const g = (id, name, year, extra = {}) => ({ id, name, first_release_date: year ? ts(year) : undefined, ...extra })

/** IGDB stub: `routes` maps a predicate on (endpoint, body) to results. */
/** IGDB's platform table as the stub knows it (name -> id). */
const PLATFORMS = { 'PC (Microsoft Windows)': 6, 'Nintendo Switch': 130, 'Nintendo Switch 2': 508, 'Wii': 5 }

/** IGDB stub. Platform lookups are answered from PLATFORMS; `calls` records game queries only. */
function fakeIgdb(handler, { platforms = PLATFORMS } = {}) {
  const calls = [], platformCalls = []
  return {
    calls, platformCalls,
    post: async (endpoint, body) => {
      if (endpoint === 'platforms') {
        platformCalls.push(body)
        return Object.entries(platforms).filter(([name]) => body.includes(`"${name}"`)).map(([name, id]) => ({ id, name }))
      }
      calls.push({ endpoint, body })
      return handler(endpoint, body)
    },
  }
}

test('normalizeTitle ignores case, punctuation and accents', () => {
  assert.equal(normalizeTitle('Pokémon: Let\'s Go, Pikachu!'), 'pokemon let s go pikachu')
  assert.equal(normalizeTitle('Ratchet & Clank'), normalizeTitle('Ratchet and Clank'))
  assert.notEqual(normalizeTitle('Hades'), normalizeTitle('Hades II'))
})

test('exact title is ranked above IGDB order', () => {
  const ranked = rankCandidates([g(2, 'Hades II', 2025), g(1, 'Hades', 2020)], { title: 'hades' })
  assert.deepEqual(ranked.map(x => x.id), [1, 2])
})

test('release year breaks ties between exact titles', () => {
  const ranked = rankCandidates([g(1, 'Prey', 2006), g(2, 'Prey', 2017)], { title: 'Prey', year: '2017' })
  assert.deepEqual(ranked.map(x => x.id), [2, 1])
})

test('without an exact title, IGDB order is kept', () => {
  const ranked = rankCandidates([g(1, 'Zelda A'), g(2, 'Zelda B')], { title: 'Zelda' })
  assert.deepEqual(ranked.map(x => x.id), [1, 2])
})

test('search is limited to the platform of the chosen system', async () => {
  const igdb = fakeIgdb(() => [g(1, 'Hades', 2020)])
  const { match } = await findMatch(igdb, { title: 'Hades', system: 'Nintendo Switch' })
  assert.equal(match.id, 1)
  assert.match(igdb.calls[0].body, /search "Hades"; where platforms = \(130\); limit 20;/)
})

test('mods, episodes and seasons are ignored', async () => {
  const igdb = fakeIgdb(() => [g(9, 'Hades', 2020, { game_type: 5 }), g(1, 'Hades', 2020, { game_type: 0 })])
  const { match } = await findMatch(igdb, { title: 'Hades', system: 'PC' })
  assert.equal(match.id, 1)
})

test('a confident first search makes no wider search', async () => {
  const igdb = fakeIgdb(() => [g(1, 'Hades')])
  await findMatch(igdb, { title: 'Hades', system: 'PC' })
  assert.equal(igdb.calls.length, 1)
  assert.match(igdb.calls[0].body, /limit 20;/)
})

test('no confident first result: searches wider, still limited to the system', async () => {
  const zelda = g(7, 'The Legend of Zelda: Tears of the Kingdom', 2023)
  const igdb = fakeIgdb((_, body) => {
    if (body.includes('limit 20;')) return [g(1, 'Zelda Musou'), g(2, 'Kingdom Hearts')]
    if (body.includes('name ~')) return [zelda]
    return []
  })
  const { match, widened } = await findMatch(igdb, { title: 'Zelda Tears of the Kingdom', system: 'Nintendo Switch' })
  assert.equal(match.id, 7)
  assert.equal(widened, true)
  assert.equal(igdb.calls.length, 3)
  for (const c of igdb.calls) assert.match(c.body, /platforms = \(130\)/)
  const words = igdb.calls.find(c => c.body.includes('name ~')).body
  assert.match(words, /name ~ \*"zelda"\* & name ~ \*"tears"\* & name ~ \*"kingdom"\* & platforms = \(130\); limit 200;/)
  assert.ok(igdb.calls.some(c => /search "Zelda Tears of the Kingdom"; where platforms = \(130\); limit 200;/.test(c.body)))
})

test('several results containing every word is not confident', async () => {
  const igdb = fakeIgdb(() => [g(1, 'Mario Kart 8'), g(2, 'Mario Kart 8 Deluxe')])
  const { match, candidates } = await findMatch(igdb, { title: 'Mario Kart', system: 'Nintendo Switch' })
  assert.equal(match, null)
  assert.deepEqual(candidates.map(x => x.id), [1, 2])
})

test('release year narrows results that contain every word', async () => {
  const igdb = fakeIgdb(() => [g(1, 'Mario Kart 8', 2014), g(2, 'Mario Kart 8 Deluxe', 2017)])
  const { match } = await findMatch(igdb, { title: 'Mario Kart', system: 'Nintendo Switch', year: '2017' })
  assert.equal(match.id, 2)
})

test('nothing confident after both searches: no match, candidates from the system only', async () => {
  const igdb = fakeIgdb(() => [g(3, 'Hadestown'), g(4, 'Hadean Lands')])
  const { match, candidates } = await findMatch(igdb, { title: 'Hades', system: 'Wii' })
  assert.equal(match, null)
  assert.deepEqual(candidates.map(x => x.id), [3, 4])
  for (const c of igdb.calls) assert.match(c.body, /platforms = \(5\)/)
})

test('results found by both wide searches are listed once', async () => {
  const igdb = fakeIgdb(() => [g(3, 'Hadestown'), g(3, 'Hadestown')])
  const { candidates } = await findMatch(igdb, { title: 'Hades', system: 'PC' })
  assert.deepEqual(candidates.map(x => x.id), [3])
})

test('significant words drop stop words and punctuation', () => {
  assert.deepEqual(significantWords('The Legend of Zelda: A Link to the Past'), ['legend', 'zelda', 'link', 'to', 'past'])
})

test('a system with no IGDB platform is searched without a platform filter', async () => {
  const igdb = fakeIgdb(() => [g(5, 'Some Game')])
  const { match } = await findMatch(igdb, { title: 'Some Game', system: 'Arcade cabinet' })
  assert.equal(match.id, 5)
  assert.doesNotMatch(igdb.calls[0].body, /platforms =/)
})

test('an IGDB ID skips the search', async () => {
  const igdb = fakeIgdb(() => [g(42, 'Exact Game', 2001)])
  const { match } = await findMatch(igdb, { title: 'whatever', system: 'PC', igdbId: '42' })
  assert.equal(match.id, 42)
  assert.match(igdb.calls[0].body, /where id = 42;/)
  assert.doesNotMatch(igdb.calls[0].body, /search/)
})

test('quotes in titles cannot break the query', async () => {
  const igdb = fakeIgdb(() => [])
  await findMatch(igdb, { title: 'A "quoted" \\ title', system: 'PC' })
  assert.match(igdb.calls[0].body, /search "A quoted  title";/)
})

test('igdbFields maps IGDB data to library fields', () => {
  const fields = igdbFields({
    id: 7, name: 'Hades', first_release_date: ts(2020),
    cover: { image_id: 'abc' },
    genres: [{ name: 'Indie' }, { name: 'Role-playing (RPG)' }, { name: 'Hack and slash/Beat \'em up' }],
    themes: [{ name: 'Fantasy' }],
    collection: { name: 'Hades' },
    involved_companies: [{ developer: false, company: { name: 'Pub' } }, { developer: true, company: { name: 'Supergiant Games' } }],
    aggregated_rating: 92.6, aggregated_rating_count: 40,
    game_modes: [{ name: 'Single player' }], player_perspectives: [{ name: 'Bird view / Isometric' }],
    dlcs: [{ name: 'Z Pack' }], expansions: [{ name: 'A Expansion' }],
    platforms: [{ name: 'PC (Microsoft Windows)' }],
  }, { timeToBeat: 22.5, bundled: [] })
  assert.deepEqual(fields, {
    igdbId: 7, title: 'Hades', cover: 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg',
    released: '2020', genre: 'Action', franchise: 'Hades', developer: 'Supergiant Games', criticScore: 93,
    gameModes: ['Single player'], perspectives: ['Bird view / Isometric'], tags: ['Fantasy'],
    dlc: ['A Expansion', 'Z Pack'], bundled: [], timeToBeat: 22.5, platforms: ['PC'],
  })
})

test('critic score needs at least three reviews', () => {
  assert.equal(igdbFields({ id: 1, name: 'x', aggregated_rating: 80, aggregated_rating_count: 2 }).criticScore, undefined)
})

test('time to beat converts seconds to hours', async () => {
  const igdb = fakeIgdb(() => [{ normally: 81000 }])
  assert.equal(await getTimeToBeat(igdb, 1), 22.5)
  assert.equal(await getTimeToBeat(fakeIgdb(() => []), 1), null)
})

test('every app system except Other has an IGDB platform name and a fallback ID', () => {
  assert.deepEqual(SYSTEMS.filter(s => s !== 'Other' && !(s in IGDB_PLATFORM_NAMES)), [])
  assert.deepEqual(SYSTEMS.filter(s => s !== 'Other' && !(s in PLATFORM_ID_MAP)), [])
})

test('the platform is looked up by its IGDB name', async () => {
  const igdb = fakeIgdb(() => [], { platforms: { 'Nintendo Switch 2': 999 } })
  assert.deepEqual(await resolvePlatform(igdb, 'Nintendo Switch 2'), { id: 999, name: 'Nintendo Switch 2', verified: true })
  assert.match(igdb.platformCalls[0], /where name = "Nintendo Switch 2"; limit 5;/)
})

test('platforms with several IGDB names try each', async () => {
  const igdb = fakeIgdb(() => [], { platforms: { 'Super Nintendo Entertainment System': 19 } })
  assert.equal((await resolvePlatform(igdb, 'Super Nintendo')).id, 19)
  assert.match(igdb.platformCalls[0], /name = "Super Nintendo Entertainment System" \| name = "Super Nintendo Entertainment System \(SNES\)"/)
})

test('if the name lookup finds nothing, the built-in ID is used and flagged', async () => {
  const igdb = fakeIgdb(() => [], { platforms: {} })
  assert.deepEqual(await resolvePlatform(igdb, 'Nintendo Switch 2'), { id: 508, name: 'Nintendo Switch 2', verified: false })
  assert.equal(await resolvePlatform(igdb, 'Arcade cabinet'), null)
})

test('Switch 2 searches use the looked-up platform, not a stale ID', async () => {
  const igdb = fakeIgdb(() => [g(152249, "Marvel's Guardians of the Galaxy", 2021)])
  const { match, searched } = await findMatch(igdb, { title: "Marvel's Guardians of the Galaxy", system: 'Nintendo Switch 2' })
  assert.equal(match.id, 152249)
  assert.match(igdb.calls[0].body, /platforms = \(508\)/)
  assert.match(searched, /IGDB platform Nintendo Switch 2, #508/)
})

test('nothing on the system but the exact title elsewhere: reported, not chosen', async () => {
  const other = g(152249, "Marvel's Guardians of the Galaxy", 2021, { platforms: [{ name: 'PlayStation 5' }] })
  const igdb = fakeIgdb((_, body) => (body.includes('platforms =') ? [] : [other]))
  const { match, candidates, elsewhere } = await findMatch(igdb, { title: "Marvel's Guardians of the Galaxy", system: 'Nintendo Switch 2' })
  assert.equal(match, null)
  assert.deepEqual(candidates, [])
  assert.equal(elsewhere.id, 152249)
})
