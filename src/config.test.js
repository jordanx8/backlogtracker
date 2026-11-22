import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config } from './config.js'

test('config defaults the branch to main', () => {
  assert.equal(config.branch, 'main')
  assert.equal(config.dataDir, 'data')
})
