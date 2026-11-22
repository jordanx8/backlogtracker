import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGitHubClient, GitHubError } from './github.js'

/** Route-table fetch stub: keys are "METHOD /path", values are [status, body] or functions. */
function stubFetch(routes) {
  const calls = []
  const fn = async (url, init) => {
    const path = url.replace('https://api.github.com', '')
    const key  = `${init.method} ${path}`
    calls.push({ key, init })
    const route = routes[key]
    if (!route) return new Response('not stubbed: ' + key, { status: 500 })
    const [status, body] = typeof route === 'function' ? route(init) : route
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  fn.calls = calls
  return fn
}

const base = { token: 't0k', owner: 'me', repo: 'lib', branch: 'main' }

test('checkWriteAccess succeeds when the blob probe succeeds', async () => {
  const fetch = stubFetch({
    'GET /repos/me/lib':            [200, { permissions: { push: true } }],
    'POST /repos/me/lib/git/blobs': [201, { sha: 'b1' }],
  })
  const gh = createGitHubClient({ ...base, fetch })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: true })
  assert.equal(fetch.calls[0].init.headers.Authorization, 'Bearer t0k')
  assert.equal(fetch.calls[0].init.cache, 'no-store')
})

test('checkWriteAccess reports an invalid token', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({ 'GET /repos/me/lib': [401, { message: 'Bad credentials' }] }) })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: false, reason: 'unauthorized' })
})

test('checkWriteAccess reports a token that cannot see the repo', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({ 'GET /repos/me/lib': [404, { message: 'Not Found' }] }) })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: false, reason: 'no_repo_access' })
})

test('checkWriteAccess reports read-only when push is false', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({ 'GET /repos/me/lib': [200, { permissions: { push: false } }] }) })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: false, reason: 'read_only' })
})

test('checkWriteAccess reports read-only when the write probe is refused', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({
    'GET /repos/me/lib':            [200, { permissions: { push: true } }],
    'POST /repos/me/lib/git/blobs': [403, { message: 'Resource not accessible by personal access token' }],
  }) })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: false, reason: 'read_only' })
})

test('checkWriteAccess reports network failures', async () => {
  const gh = createGitHubClient({ ...base, fetch: async () => { throw new TypeError('Failed to fetch') } })
  assert.deepEqual(await gh.checkWriteAccess(), { ok: false, reason: 'network' })
})

test('readFiles returns raw text and null for missing files', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({
    'GET /repos/me/lib/contents/data/games.json?ref=c1':   [200, '[{"id":1}]'],
    'GET /repos/me/lib/contents/data/journal.json?ref=c1': [404, { message: 'Not Found' }],
  }) })
  assert.deepEqual(await gh.readFiles('c1', ['data/games.json', 'data/journal.json']), {
    'data/games.json':   '[{"id":1}]',
    'data/journal.json': null,
  })
})

test('commitFiles creates one commit with both files and fast-forwards the branch', async () => {
  const fetch = stubFetch({
    'GET /repos/me/lib/git/commits/p1':    [200, { tree: { sha: 'tree0' } }],
    'POST /repos/me/lib/git/trees':        [201, { sha: 'tree1' }],
    'POST /repos/me/lib/git/commits':      [201, { sha: 'c2' }],
    'PATCH /repos/me/lib/git/refs/heads/main': [200, { object: { sha: 'c2' } }],
  })
  const gh = createGitHubClient({ ...base, fetch })
  const sha = await gh.commitFiles({ parentSha: 'p1', files: { 'data/a.json': 'A', 'data/b.json': 'B' }, message: 'msg' })
  assert.equal(sha, 'c2')

  const tree = JSON.parse(fetch.calls.find(c => c.key === 'POST /repos/me/lib/git/trees').init.body)
  assert.equal(tree.base_tree, 'tree0')
  assert.deepEqual(tree.tree.map(t => [t.path, t.content]), [['data/a.json', 'A'], ['data/b.json', 'B']])

  const commit = JSON.parse(fetch.calls.find(c => c.key === 'POST /repos/me/lib/git/commits').init.body)
  assert.deepEqual(commit, { message: 'msg', tree: 'tree1', parents: ['p1'] })

  const ref = JSON.parse(fetch.calls.find(c => c.key.startsWith('PATCH')).init.body)
  assert.deepEqual(ref, { sha: 'c2', force: false })
})

test('commitFiles reports a conflict when the ref update is not a fast-forward', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({
    'GET /repos/me/lib/git/commits/p1':    [200, { tree: { sha: 'tree0' } }],
    'POST /repos/me/lib/git/trees':        [201, { sha: 'tree1' }],
    'POST /repos/me/lib/git/commits':      [201, { sha: 'c2' }],
    'PATCH /repos/me/lib/git/refs/heads/main': [422, { message: 'Update is not a fast forward' }],
  }) })
  await assert.rejects(
    gh.commitFiles({ parentSha: 'p1', files: { 'x': 'y' }, message: 'm' }),
    e => e instanceof GitHubError && e.kind === 'conflict',
  )
})

test('requests surface 401 as unauthorized', async () => {
  const gh = createGitHubClient({ ...base, fetch: stubFetch({ 'GET /repos/me/lib/git/ref/heads/main': [401, {}] }) })
  await assert.rejects(gh.getHeadSha(), e => e.kind === 'unauthorized' && e.status === 401)
})
