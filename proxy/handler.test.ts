import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, configFromEnv } from './handler.ts'

const CFG = {
  igdbClientId: 'cid',
  igdbClientSecret: 'csecret',
  githubOwner: 'me',
  githubRepo: 'lib',
  allowedOrigins: ['https://me.github.io'],
}

type Call = { url: string, init: RequestInit }

/** Upstream stub for GitHub, Twitch and IGDB. `pushTokens` are tokens with write access. */
function upstream({ pushTokens = ['good'], igdbStatus = [200] as number[] } = {}) {
  const calls: Call[] = []
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization ?? ''
    if (url.startsWith('https://api.github.com/repos/me/lib')) {
      const ok = pushTokens.includes(auth.replace('Bearer ', ''))
      if (url.endsWith('/git/blobs')) return new Response('{}', { status: ok ? 201 : 403 })
      return new Response(JSON.stringify({ permissions: { push: ok } }), { status: ok ? 200 : 200 })
    }
    if (url.startsWith('https://id.twitch.tv/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: `tw${calls.length}`, expires_in: 3600 }))
    }
    if (url.startsWith('https://api.igdb.com/v4/')) {
      const status = igdbStatus.length > 1 ? igdbStatus.shift()! : igdbStatus[0]
      return new Response(JSON.stringify([{ id: 1, name: 'Hades' }]), { status })
    }
    return new Response('unexpected', { status: 500 })
  }
  return { fetch: fetch as typeof globalThis.fetch, calls }
}

const req = (path: string, { method = 'POST', token = 'good' as string | null, origin = 'https://me.github.io' as string | null, body = 'fields name;' } = {}) => {
  const headers: Record<string, string> = {}
  if (token)  headers.Authorization = `Bearer ${token}`
  if (origin) headers.Origin = origin
  return new Request(`https://proxy.example${path}`, { method, headers, body: method === 'POST' ? body : undefined })
}

test('forwards an allowed query for a token with write access', async () => {
  const up = upstream()
  const handle = createHandler(CFG, { fetch: up.fetch })
  const res = await handle(req('/igdb/games'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), [{ id: 1, name: 'Hades' }])
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://me.github.io')

  const igdbCall = up.calls.find(c => c.url === 'https://api.igdb.com/v4/games')!
  const h = igdbCall.init.headers as Record<string, string>
  assert.equal(h['Client-ID'], 'cid')
  assert.match(h.Authorization, /^Bearer tw/)
  assert.equal(igdbCall.init.body, 'fields name;')
  // The client secret goes to Twitch only, never back to the browser
  assert.ok(up.calls.some(c => c.url.includes('client_secret=csecret') && c.url.startsWith('https://id.twitch.tv/')))
})

test('refuses a request without a token and makes no IGDB call', async () => {
  const up = upstream()
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/games', { token: null }))
  assert.equal(res.status, 401)
  assert.equal(up.calls.length, 0)
})

test('refuses a token without write access and makes no IGDB call', async () => {
  const up = upstream()
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/games', { token: 'readonly' }))
  assert.equal(res.status, 403)
  assert.equal(up.calls.some(c => c.url.includes('api.igdb.com')), false)
})

test('refuses endpoints outside the allowlist', async () => {
  const up = upstream()
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/characters'))
  assert.equal(res.status, 403)
  assert.equal(up.calls.length, 0)
})

test('refuses other origins without CORS headers', async () => {
  const up = upstream()
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/games', { origin: 'https://evil.example' }))
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(up.calls.length, 0)
})

test('allows localhost origins for development', async () => {
  const up = upstream()
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/games', { origin: 'http://localhost:5173' }))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
})

test('answers CORS preflight for allowed origins', async () => {
  const res = await createHandler(CFG, { fetch: upstream().fetch })(req('/igdb/games', { method: 'OPTIONS', token: null }))
  assert.equal(res.status, 204)
  assert.match(res.headers.get('Access-Control-Allow-Headers') ?? '', /Authorization/)
})

test('caches token checks and the Twitch token across requests', async () => {
  const up = upstream()
  let t = 0
  const handle = createHandler(CFG, { fetch: up.fetch, now: () => t })
  await handle(req('/igdb/games'))
  await handle(req('/igdb/screenshots'))
  assert.equal(up.calls.filter(c => c.url.startsWith('https://api.github.com')).length, 2)  // one check: repo + blob
  assert.equal(up.calls.filter(c => c.url.startsWith('https://id.twitch.tv')).length, 1)

  t += 11 * 60 * 1000  // past the 10 minute access cache
  await handle(req('/igdb/games'))
  assert.equal(up.calls.filter(c => c.url.startsWith('https://api.github.com')).length, 4)
})

test('refreshes the Twitch token once when IGDB rejects it', async () => {
  const up = upstream({ igdbStatus: [401, 200] })
  const res = await createHandler(CFG, { fetch: up.fetch })(req('/igdb/games'))
  assert.equal(res.status, 200)
  assert.equal(up.calls.filter(c => c.url.startsWith('https://id.twitch.tv')).length, 2)
})

test('rejects oversized queries', async () => {
  const res = await createHandler(CFG, { fetch: upstream().fetch })(req('/igdb/games', { body: 'x'.repeat(9000) }))
  assert.equal(res.status, 413)
})

test('configFromEnv requires credentials and splits origins', () => {
  const env: Record<string, string> = {
    IGDB_CLIENT_ID: 'a', IGDB_CLIENT_SECRET: 'b', GITHUB_OWNER: 'o', GITHUB_REPO: 'r',
    ALLOWED_ORIGIN: 'https://o.github.io, https://other.example',
  }
  assert.deepEqual(configFromEnv(n => env[n]).allowedOrigins, ['https://o.github.io', 'https://other.example'])
  assert.throws(() => configFromEnv(() => undefined), /IGDB_CLIENT_ID/)
})
