import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncEngine, STATE_KEY, LEGACY_KEYS, serialize } from './engine.js'
import { GitHubError } from '../api/github.js'

const PATHS = { games: 'data/games.json', journal: 'data/journal.json' }

/** In-memory "GitHub": a linear branch of commits holding file contents. */
function fakeRepo(initial = { games: [], journal: {} }) {
  const commits = new Map()
  let n = 0
  const add = (files, message) => {
    const sha = `c${n++}`
    commits.set(sha, { files, message })
    return sha
  }
  let head = add({ [PATHS.games]: serialize(initial.games), [PATHS.journal]: serialize(initial.journal) }, 'init')
  const repo = {
    commits,
    get head() { return head },
    files() { return commits.get(head).files },
    library() {
      const f = repo.files()
      return { games: JSON.parse(f[PATHS.games]), journal: JSON.parse(f[PATHS.journal]) }
    },
    /** Simulate another device committing directly. */
    push(library, message = 'other device') {
      head = add({ [PATHS.games]: serialize(library.games), [PATHS.journal]: serialize(library.journal) }, message)
    },
    failNext: null,
    client: {
      async getHeadSha() {
        if (repo.failNext) { const e = repo.failNext; repo.failNext = null; throw e }
        return head
      },
      async readFiles(sha, paths) {
        const f = commits.get(sha).files
        return Object.fromEntries(paths.map(p => [p, f[p] ?? null]))
      },
      async commitFiles({ parentSha, files, message }) {
        if (repo.failNext) { const e = repo.failNext; repo.failNext = null; throw e }
        if (parentSha !== head) throw new GitHubError('not a fast forward', 'conflict', 422)
        head = add({ ...commits.get(parentSha).files, ...files }, message)
        return head
      },
    },
  }
  return repo
}

function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    map: m,
  }
}

/** Manual timers so tests control when the debounce fires. */
function manualTimers() {
  const pending = new Set()
  return {
    setTimer: (fn, ms) => { const t = { fn, ms }; pending.add(t); return t },
    clearTimer: t => pending.delete(t),
    async fire() {
      const all = [...pending]; pending.clear()
      for (const t of all) await t.fn()
    },
    get count() { return pending.size },
  }
}

function engineFor(repo, storage = memoryStorage(), timers = manualTimers(), events = []) {
  const engine = createSyncEngine({
    client: repo.client, storage, paths: PATHS,
    onChange: e => events.push(e),
    setTimer: timers.setTimer, clearTimer: timers.clearTimer,
  })
  return { engine, storage, timers, events }
}

const game = (id, fields = {}) => ({ id, title: `Game ${id}`, status: 'backlog', ...fields })

test('fresh device loads the latest commit', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: { 1: [{ id: 9, text: 'hi' }] } })
  const { engine } = engineFor(repo)
  assert.equal(engine.cached(), null)
  const lib = await engine.load()
  assert.deepEqual(lib, repo.library())
  assert.equal(engine.status().status, 'saved')
})

test('a reload is served from the device cache', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const storage = memoryStorage()
  await engineFor(repo, storage).engine.load()
  const { engine } = engineFor(repo, storage)
  assert.deepEqual(engine.cached(), repo.library())
})

test('a burst of edits becomes one commit after the debounce', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, timers } = engineFor(repo)
  let lib = await engine.load()
  const before = repo.commits.size
  for (const r of [1, 2, 3]) {
    lib = { ...lib, games: [game(1, { rating: r })] }
    engine.update(lib)
  }
  assert.equal(engine.status().status, 'unsaved')
  assert.equal(timers.count, 1)
  await timers.fire()
  assert.equal(repo.commits.size, before + 1)
  assert.deepEqual(repo.library().games, [game(1, { rating: 3 })])
  assert.equal(repo.commits.get(repo.head).message, 'Update library: edit Game 1 (rating)')
  assert.equal(engine.status().status, 'saved')
})

test('passing back the same objects is not an edit', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, timers } = engineFor(repo)
  const lib = await engine.load()
  engine.update({ games: lib.games, journal: lib.journal })
  assert.equal(timers.count, 0)
  assert.equal(engine.isDirty(), false)
})

test('two devices editing different games both land', async () => {
  const repo = fakeRepo({ games: [game(1), game(2)], journal: {} })
  const a = engineFor(repo), b = engineFor(repo)
  const libA = await a.engine.load()
  const libB = await b.engine.load()

  a.engine.update({ ...libA, games: [game(1, { status: 'playing' }), game(2)] })
  await a.timers.fire()
  b.engine.update({ ...libB, games: [game(1), game(2, { rating: 8 })] })
  await b.timers.fire()

  assert.deepEqual(repo.library().games, [game(1, { status: 'playing' }), game(2, { rating: 8 })])
  // B was told about the merged library so the UI can show it
  const shown = b.events.filter(e => e.library).at(-1).library
  assert.deepEqual(shown.games, repo.library().games)
  assert.equal(b.engine.status().status, 'saved')
})

test('refresh with no local edits picks up the other device silently', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, events } = engineFor(repo)
  await engine.load()
  repo.push({ games: [game(1), game(2)], journal: {} })
  await engine.refresh()
  assert.deepEqual(events.at(-2).library.games, [game(1), game(2)])
  assert.equal(engine.status().status, 'saved')
})

test('refresh with local edits merges and saves', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine } = engineFor(repo)
  const lib = await engine.load()
  engine.update({ ...lib, games: [game(1, { rating: 4 })] })
  repo.push({ games: [game(1), game(2)], journal: {} })
  await engine.refresh()
  assert.deepEqual(repo.library().games, [game(1, { rating: 4 }), game(2)])
  assert.equal(engine.isDirty(), false)
})

test('offline save keeps edits and reports offline; they save later', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, timers, storage } = engineFor(repo)
  const lib = await engine.load()
  engine.update({ ...lib, games: [game(1, { rating: 1 })] })
  repo.failNext = new GitHubError('Failed to fetch', 'network')
  await timers.fire()
  assert.equal(engine.status().status, 'offline')
  assert.equal(JSON.parse(storage.getItem(STATE_KEY)).dirty, true)
  assert.equal(timers.count, 1)          // retry scheduled
  await timers.fire()
  assert.deepEqual(repo.library().games, [game(1, { rating: 1 })])
  assert.equal(engine.status().status, 'saved')
})

test('a rejected token reports unauthorized and keeps edits', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, timers, storage } = engineFor(repo)
  const lib = await engine.load()
  engine.update({ ...lib, games: [] })
  repo.failNext = new GitHubError('bad', 'unauthorized', 401)
  await timers.fire()
  assert.equal(engine.status().status, 'unauthorized')
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)).local.games, [])
})

test('edits left unsaved on a closed device are saved on next open', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const storage = memoryStorage()
  const first = engineFor(repo, storage)
  const lib = await first.engine.load()
  first.engine.update({ ...lib, games: [game(1), game(2)] })   // page closed before debounce

  const second = engineFor(repo, storage)
  await second.engine.load()
  await second.timers.fire()
  assert.deepEqual(repo.library().games, [game(1), game(2)])
})

test('unsaved edits from the previous app version are merged and saved', async () => {
  const repo = fakeRepo({ games: [game(1), game(2)], journal: {} })
  const storage = memoryStorage({
    [LEGACY_KEYS.games]:   JSON.stringify([game(1, { status: 'completed' }), game(2)]),
    [LEGACY_KEYS.journal]: JSON.stringify({ 1: [{ id: 5, text: 'old note' }] }),
    [LEGACY_KEYS.dirty]:   'true',
  })
  const { engine, timers } = engineFor(repo, storage)
  const lib = await engine.load()
  assert.equal(lib.games[0].status, 'completed')
  await timers.fire()
  assert.deepEqual(repo.library(), {
    games:   [game(1, { status: 'completed' }), game(2)],
    journal: { 1: [{ id: 5, text: 'old note' }] },
  })
  for (const k of Object.values(LEGACY_KEYS)) assert.equal(storage.getItem(k), null)
})

test('clean legacy keys are simply removed', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const storage = memoryStorage({ [LEGACY_KEYS.games]: '[]', [LEGACY_KEYS.journal]: '{}' })
  const { engine } = engineFor(repo, storage)
  await engine.load()
  assert.equal(storage.getItem(LEGACY_KEYS.games), null)
  assert.equal(engine.isDirty(), false)
})

test('missing data files load as an empty library', async () => {
  const repo = fakeRepo()
  repo.commits.get(repo.head).files = {}
  const { engine } = engineFor(repo)
  assert.deepEqual(await engine.load(), { games: [], journal: {} })
})

test('clear removes everything stored on the device', async () => {
  const repo = fakeRepo({ games: [game(1)], journal: {} })
  const { engine, storage } = engineFor(repo)
  await engine.load()
  engine.clear()
  assert.equal(storage.getItem(STATE_KEY), null)
  assert.equal(engine.cached(), null)
})
