import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeChanges } from './summary.js'

const g = (id, title, fields = {}) => ({ id, title, status: 'backlog', ...fields })

test('edit with fields and an addition are both named', () => {
  const prev = { games: [g(1, 'Pragmata')], journal: {} }
  const next = { games: [g(1, 'Pragmata', { status: 'completed' }), g(2, 'Hades')], journal: {} }
  assert.equal(summarizeChanges(prev, next), 'Update library: edit Pragmata (status); add Hades')
})

test('removals are named', () => {
  const prev = { games: [g(1, 'A'), g(2, 'B')], journal: { 2: [{ id: 1 }] } }
  const next = { games: [g(1, 'A')], journal: {} }
  assert.equal(summarizeChanges(prev, next), 'Update library: remove B')
})

test('journal changes name the game, and sub-game keys name the sub-game', () => {
  const prev = { games: [g(1, 'Pragmata'), g(2, 'Collection')], journal: {} }
  const next = { games: prev.games, journal: { 1: [{ id: 5 }], '2:Episode One': [{ id: 6 }] } }
  assert.equal(summarizeChanges(prev, next), 'Update library: journal Pragmata, Episode One')
})

test('many changes are truncated with "and N more"', () => {
  const prev = { games: [], journal: {} }
  const next = { games: Array.from({ length: 10 }, (_, i) => g(i, `G${i}`)), journal: {} }
  assert.equal(summarizeChanges(prev, next), 'Update library: add G0, G1, G2 and 7 more')
})

test('several edits list games without fields', () => {
  const prev = { games: [g(1, 'A'), g(2, 'B')], journal: {} }
  const next = { games: [g(1, 'A', { rating: 1 }), g(2, 'B', { rating: 2 })], journal: {} }
  assert.equal(summarizeChanges(prev, next), 'Update library: edit A, B')
})

test('no differences gives a generic message', () => {
  const lib = { games: [g(1, 'A')], journal: {} }
  assert.equal(summarizeChanges(lib, lib), 'Update library')
})
