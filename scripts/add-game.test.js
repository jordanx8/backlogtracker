import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readInputs, applyMatch, run, GAMES_PATH } from './add-game.js'
import { GitHubError } from '../src/api/github.js'
import { serialize } from '../src/sync/engine.js'
import { SYSTEMS, STATUSES, OWNERSHIP } from '../src/constants.js'

const ts = year => Date.UTC(year, 5, 1) / 1000

// ── fakes ────────────────────────────────────────────────────────────────────

const HADES = {
  id: 113112, name: 'Hades', first_release_date: ts(2020), cover: { image_id: 'cov' },
  genres: [{ name: 'Role-playing (RPG)' }], involved_companies: [{ developer: true, company: { name: 'Supergiant Games' } }],
  dlcs: [], expansions: [], platforms: [{ name: 'PC (Microsoft Windows)' }],
}

function fakeIgdb(results = [HADES]) {
  return {
    post: async (endpoint, body) => {
      if (endpoint === 'game_time_to_beats') return [{ normally: 79200 }]
      if (body.includes('where bundles')) return []
      return results
    },
  }
}

function fakeGithub(games, { conflictWith } = {}) {
  let head = 'c0'
  const files = { c0: serialize(games) }
  const commits = []
  return {
    commits,
    files,
    get head() { return head },
    library: () => JSON.parse(files[head]),
    async getHeadSha() { return head },
    async readFiles(sha, paths) { return { [paths[0]]: files[sha] } },
    async commitFiles({ parentSha, files: f, message }) {
      if (conflictWith) {
        // Another device saves first, once
        files.c1 = serialize(conflictWith); head = 'c1'; conflictWith = null
      }
      if (parentSha !== head) throw new GitHubError('not a fast forward', 'conflict', 422)
      const sha = `c${Object.keys(files).length}`
      files[sha] = f[GAMES_PATH]; head = sha
      commits.push({ sha, message })
      return sha + 'abcdef'
    },
  }
}

const inputs = (over = {}) => readInputs({ title: 'Hades', system: 'PC', status: 'playing', ownership: 'digital', ...over })
const mine = (over = {}) => ({ id: 1, title: 'Celeste', system: 'PC', status: 'completed', rating: 5, notes: 'great', ...over })

// ── inputs ───────────────────────────────────────────────────────────────────

test('readInputs validates and normalises', () => {
  assert.deepEqual(readInputs({ title: ' Hades ', system: 'PC', ownership: 'none', preview: 'true' }), {
    title: 'Hades', system: 'PC', status: 'backlog', ownership: '', year: null, igdbId: null, preview: true,
  })
  assert.equal(readInputs({ title: 'x', system: 'Other', 'other-system': 'Arcade' }).system, 'Arcade')
  assert.throws(() => readInputs({ system: 'PC' }), /title is required/)
  assert.throws(() => readInputs({ title: 'x', system: 'Other' }), /other system/)
  assert.throws(() => readInputs({ title: 'x', system: 'PC', year: '20' }), /four digits/)
  assert.throws(() => readInputs({ title: 'x', system: 'PC', 'igdb-id': 'abc' }), /number/)
  assert.throws(() => readInputs({ title: 'x', system: 'PC', status: 'beaten' }), /Unknown status/)
})

// ── running ──────────────────────────────────────────────────────────────────

test('adds a new game with the options entered and IGDB details', async () => {
  const github = fakeGithub([mine()])
  const { outcome, summary } = await run({ inputs: inputs(), igdb: fakeIgdb(), github, now: 1000 })
  assert.equal(outcome, 'added')
  const added = github.library()[1]
  assert.deepEqual(
    { title: added.title, system: added.system, status: added.status, ownership: added.ownership, genre: added.genre, developer: added.developer, timeToBeat: added.timeToBeat, igdbId: added.igdbId, released: added.released, id: added.id, lastSynced: added.lastSynced },
    { title: 'Hades', system: 'PC', status: 'playing', ownership: 'digital', genre: 'RPG', developer: 'Supergiant Games', timeToBeat: 22, igdbId: 113112, released: '2020', id: 1000, lastSynced: 1000 },
  )
  assert.equal(github.commits[0].message, 'Add from IGDB: Hades (PC)')
  assert.match(summary, /\*\*Match:\*\* Hades \(2020\) · IGDB ID 113112/)
  assert.match(summary, /\*\*Added\*\*/)
})

test('preview reports the match and commits nothing', async () => {
  const github = fakeGithub([])
  const { outcome, summary } = await run({ inputs: inputs({ preview: true }), igdb: fakeIgdb(), github })
  assert.equal(outcome, 'preview')
  assert.equal(github.commits.length, 0)
  assert.match(summary, /would have been \*\*added\*\*/)
})

test('no match: library unchanged, candidates listed with IGDB IDs', async () => {
  const github = fakeGithub([])
  const igdb = fakeIgdb([{ id: 5, name: 'Hades II', first_release_date: ts(2025) }])
  const { outcome, summary } = await run({ inputs: inputs({ system: 'Other', 'other-system': 'Arcade' }), igdb, github })
  assert.equal(outcome, 'no_match')
  assert.equal(github.commits.length, 0)
  assert.match(summary, /Hades II \(2025\) · IGDB ID 5/)
})

test('a game already in the library is refreshed, keeping the owner\'s fields', async () => {
  const existing = {
    id: 7, title: 'hades', system: 'PC', status: 'completed', ownership: 'physical', rating: 4, notes: 'mine',
    cover: 'https://example.com/my-cover.jpg', dlc: [{ title: 'Old DLC', done: true }],
  }
  const github = fakeGithub([existing])
  const igdb = fakeIgdb([{ ...HADES, dlcs: [{ name: 'Old DLC' }, { name: 'New DLC' }] }])
  const { outcome } = await run({ inputs: inputs(), igdb, github, now: 5 })
  assert.equal(outcome, 'updated')
  const lib = github.library()
  assert.equal(lib.length, 1)
  assert.deepEqual(
    { ...lib[0], gameModes: undefined, perspectives: undefined, tags: undefined, criticScore: undefined, franchise: undefined },
    { ...existing, genre: 'RPG', developer: 'Supergiant Games', timeToBeat: 22, released: '2020', igdbId: 113112, lastSynced: 5,
      dlc: [{ title: 'New DLC', done: false }, { title: 'Old DLC', done: true }],
      gameModes: undefined, perspectives: undefined, tags: undefined, criticScore: undefined, franchise: undefined },
  )
})

test('matching an existing game by IGDB ID even if its title differs', () => {
  const games = [{ id: 1, title: 'My Hades', system: 'Switch', igdbId: 113112, status: 'backlog' }]
  const fields = { igdbId: 113112, title: 'Hades', genre: '', franchise: '', gameModes: [], perspectives: [], tags: [], dlc: [], bundled: [], timeToBeat: null }
  const { action, games: out } = applyMatch(games, fields, inputs(), 9)
  assert.equal(action, 'updated')
  assert.equal(out[0].title, 'My Hades')
})

test('bundled games become included games on a new entry', () => {
  const fields = { igdbId: 1, title: 'Collection', genre: '', franchise: '', gameModes: [], perspectives: [], tags: [], dlc: [], bundled: ['One', 'Two'], timeToBeat: null }
  const { game } = applyMatch([], fields, inputs({ title: 'Collection' }), 9)
  assert.deepEqual(game.includedGames, [{ title: 'One', status: 'backlog', done: false }, { title: 'Two', status: 'backlog', done: false }])
})

test('if the app saves during the run, both changes are kept', async () => {
  const before = [mine()]
  const appEdit = [mine({ rating: 3 })]           // the app changed Celeste's rating meanwhile
  const github = fakeGithub(before, { conflictWith: appEdit })
  const { outcome } = await run({ inputs: inputs(), igdb: fakeIgdb(), github, now: 2 })
  assert.equal(outcome, 'added')
  const lib = github.library()
  assert.equal(lib[0].rating, 3)
  assert.equal(lib[1].title, 'Hades')
})

// ── workflow file ────────────────────────────────────────────────────────────

test('the workflow form offers exactly the app\'s systems, statuses and ownership options', () => {
  const yml = readFileSync(new URL('../.github/workflows/add-game.yml', import.meta.url), 'utf8')
  const optionsOf = (input) => {
    const block = yml.split(new RegExp(`^      ${input}:\\s*$`, 'm'))[1].split(/^      \S/m)[0]
    return [...block.split(/options:\s*\n/)[1].matchAll(/^\s+- (.+)$/gm)].map(m => m[1].trim().replace(/^'(.*)'$/, '$1'))
  }
  assert.deepEqual(optionsOf('system'), SYSTEMS)
  assert.deepEqual(optionsOf('status'), STATUSES)
  assert.deepEqual(optionsOf('ownership'), ['none', ...OWNERSHIP])
})
