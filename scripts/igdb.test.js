import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMatch, rankCandidates, normalizeTitle, igdbFields, getTimeToBeat, PLATFORM_ID_MAP } from './igdb.js'
import { SYSTEMS } from '../src/constants.js'

const ts = year => Date.UTC(year, 5, 1) / 1000
const g = (id, name, year, extra = {}) => ({ id, name, first_release_date: year ? ts(year) : undefined, ...extra })

/** IGDB stub: `routes` maps a predicate on (endpoint, body) to results. */
function fakeIgdb(handler) {
  const calls = []
  return { calls, post: async (endpoint, body) => { calls.push({ endpoint, body }); return handler(endpoint, body) } }
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
  assert.match(igdb.calls[0].body, /where platforms = \(130\);/)
  assert.match(igdb.calls[0].body, /search "Hades";/)
})

test('mods, episodes and seasons are ignored', async () => {
  const igdb = fakeIgdb(() => [g(9, 'Hades', 2020, { game_type: 5 }), g(1, 'Hades', 2020, { game_type: 0 })])
  const { match } = await findMatch(igdb, { title: 'Hades', system: 'PC' })
  assert.equal(match.id, 1)
})

test('nothing on the platform: an exact title elsewhere is accepted', async () => {
  const igdb = fakeIgdb((_, body) => (body.includes('where platforms') ? [] : [g(3, 'Hades II'), g(1, 'Hades')]))
  const { match } = await findMatch(igdb, { title: 'Hades', system: 'Wii' })
  assert.equal(match.id, 1)
  assert.equal(igdb.calls.length, 2)
})

test('nothing on the platform and no exact title elsewhere: no match, candidates returned', async () => {
  const igdb = fakeIgdb((_, body) => (body.includes('where platforms') ? [] : [g(3, 'Hades II'), g(4, 'Hadestown')]))
  const { match, candidates } = await findMatch(igdb, { title: 'Hades', system: 'Wii' })
  assert.equal(match, null)
  assert.deepEqual(candidates.map(x => x.id), [3, 4])
})

test('a system with no IGDB platform searches everywhere, exact title only', async () => {
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

test('every app system except Other maps to an IGDB platform', () => {
  assert.deepEqual(SYSTEMS.filter(s => s !== 'Other' && !(s in PLATFORM_ID_MAP)), [])
})
