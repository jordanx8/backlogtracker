import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mergeGames, mergeJournal, mergeLibrary, mergeRecord, same } from './merge.js'

const g = (id, fields = {}) => ({ id, title: `Game ${id}`, status: 'backlog', rating: null, tags: [], ...fields })

describe('mergeGames', () => {
  test('different games edited on two devices keeps both edits', () => {
    const base   = [g(1), g(2)]
    const local  = [g(1, { status: 'playing' }), g(2)]
    const remote = [g(1), g(2, { rating: 8 })]
    assert.deepEqual(mergeGames(base, local, remote), [g(1, { status: 'playing' }), g(2, { rating: 8 })])
  })

  test('same game, different fields merges field by field', () => {
    const base   = [g(1)]
    const local  = [g(1, { rating: 9 })]
    const remote = [g(1, { status: 'completed' })]
    assert.deepEqual(mergeGames(base, local, remote), [g(1, { status: 'completed', rating: 9 })])
  })

  test('same field changed on both sides: local (the saving device) wins', () => {
    const base   = [g(1)]
    const local  = [g(1, { status: 'shelved' })]
    const remote = [g(1, { status: 'completed' })]
    assert.equal(mergeGames(base, local, remote)[0].status, 'shelved')
  })

  test('array fields are compared as whole values', () => {
    const base   = [g(1, { tags: ['a'] })]
    const local  = [g(1, { tags: ['a', 'b'] })]
    const remote = [g(1, { tags: ['a', 'c'] })]
    assert.deepEqual(mergeGames(base, local, remote)[0].tags, ['a', 'b'])
  })

  test('a field removed on one side is removed', () => {
    const base   = [g(1, { notes: 'x' })]
    const local  = [g(1)]
    const remote = [g(1, { notes: 'x' })]
    assert.equal('notes' in mergeGames(base, local, remote)[0], false)
  })

  test('deleted on one side, unchanged on the other: deleted', () => {
    assert.deepEqual(mergeGames([g(1), g(2)], [g(2)], [g(1), g(2)]), [g(2)])
    assert.deepEqual(mergeGames([g(1), g(2)], [g(1), g(2)], [g(2)]), [g(2)])
  })

  test('deleted on one side, edited on the other: the edited game is kept', () => {
    assert.deepEqual(mergeGames([g(1)], [], [g(1, { rating: 5 })]), [g(1, { rating: 5 })])
    assert.deepEqual(mergeGames([g(1)], [g(1, { rating: 5 })], []), [g(1, { rating: 5 })])
  })

  test('deleted on both sides: gone', () => {
    assert.deepEqual(mergeGames([g(1), g(2)], [g(2)], [g(2)]), [g(2)])
  })

  test('additions on both sides are all kept: remote order, then local additions', () => {
    const base   = [g(1)]
    const local  = [g(1), g(10)]
    const remote = [g(1), g(20)]
    assert.deepEqual(mergeGames(base, local, remote).map(x => x.id), [1, 20, 10])
  })

  test('no remote changes returns local content', () => {
    const base  = [g(1), g(2)]
    const local = [g(2, { rating: 3 }), g(3)]
    assert.deepEqual(mergeGames(base, local, base), [g(2, { rating: 3 }), g(3)])
  })
})

describe('mergeJournal', () => {
  const e = (id, text, date = '2026-11-01') => ({ id, date, text })

  test('entries added on both sides for the same game are both kept', () => {
    const base   = { 1: [e(100, 'a')] }
    const local  = { 1: [e(100, 'a'), e(101, 'local')] }
    const remote = { 1: [e(100, 'a'), e(102, 'remote')] }
    assert.deepEqual(mergeJournal(base, local, remote), { 1: [e(100, 'a'), e(102, 'remote'), e(101, 'local')] })
  })

  test('new journal keys on either side are kept, including sub-game keys', () => {
    const merged = mergeJournal({}, { '1': [e(1, 'x')] }, { '2:Sub Game': [e(2, 'y')] })
    assert.deepEqual(merged, { '2:Sub Game': [e(2, 'y')], '1': [e(1, 'x')] })
  })

  test('entry deleted on one side and untouched on the other is deleted', () => {
    const base = { 1: [e(1, 'a'), e(2, 'b')] }
    assert.deepEqual(mergeJournal(base, { 1: [e(2, 'b')] }, base), { 1: [e(2, 'b')] })
  })

  test('entry deleted on one side and edited on the other is kept', () => {
    const base = { 1: [e(1, 'a')] }
    assert.deepEqual(mergeJournal(base, { 1: [] }, { 1: [e(1, 'edited')] }), { 1: [e(1, 'edited')] })
  })

  test('a game deleted locally drops its untouched journal', () => {
    const base = { 1: [e(1, 'a')], 2: [e(2, 'b')] }
    assert.deepEqual(mergeJournal(base, { 2: [e(2, 'b')] }, base), { 2: [e(2, 'b')] })
  })

  test('same entry edited on both sides: local wins per field', () => {
    const base = { 1: [e(1, 'a', '2026-01-01')] }
    const merged = mergeJournal(base, { 1: [e(1, 'local', '2026-01-01')] }, { 1: [e(1, 'remote', '2026-02-02')] })
    assert.deepEqual(merged, { 1: [e(1, 'local', '2026-02-02')] })
  })
})

test('mergeLibrary merges games and journal together', () => {
  const base   = { games: [g(1)], journal: {} }
  const local  = { games: [g(1), g(2)], journal: { 2: [{ id: 9, date: 'd', text: 't' }] } }
  const remote = { games: [g(1, { rating: 7 })], journal: {} }
  assert.deepEqual(mergeLibrary(base, local, remote), {
    games:   [g(1, { rating: 7 }), g(2)],
    journal: { 2: [{ id: 9, date: 'd', text: 't' }] },
  })
})

test('same() ignores key order', () => {
  assert.equal(same({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }), true)
  assert.equal(same([1, 2], [2, 1]), false)
})

test('mergeRecord with no base treats both sides as additions', () => {
  assert.deepEqual(mergeRecord({}, { id: 1, a: 1 }, { id: 1, b: 2 }), { id: 1, a: 1, b: 2 })
})
