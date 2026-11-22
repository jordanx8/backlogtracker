/**
 * IGDB proxy: holds the IGDB (Twitch) credentials and forwards a fixed set of
 * IGDB queries for the repository owner only.
 *
 * Every request must carry `Authorization: Bearer <GitHub token>` for a token
 * that can write to the configured repository (the same token the app signs in
 * with). Browser requests are limited to the app's own origins via CORS.
 *
 * Written against web-standard Request/Response so it runs on Deno Deploy (see
 * main.ts) and can be unit-tested anywhere.
 */

import { createGitHubClient } from '../src/api/github.js'

export interface ProxyConfig {
  igdbClientId: string
  igdbClientSecret: string
  githubOwner: string
  githubRepo: string
  /** Exact origins allowed in addition to http://localhost:* and http://127.0.0.1:* */
  allowedOrigins: string[]
}

export interface ProxyDeps {
  fetch?: typeof fetch
  now?: () => number
}

/** IGDB endpoints the app uses; anything else is refused. */
export const ALLOWED_ENDPOINTS = new Set(['games', 'game_time_to_beats', 'screenshots'])

const ACCESS_TTL_MS  = 10 * 60 * 1000
const MAX_BODY_BYTES = 8 * 1024
const LOCAL_ORIGIN   = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

export function createHandler(cfg: ProxyConfig, deps: ProxyDeps = {}) {
  const doFetch = deps.fetch ?? globalThis.fetch
  const now     = deps.now ?? Date.now

  const accessCache = new Map<string, number>()     // token hash → expiry
  let twitch: { token: string, expiry: number } | null = null

  const originAllowed = (origin: string | null) =>
    origin === null || LOCAL_ORIGIN.test(origin) || cfg.allowedOrigins.includes(origin)

  function cors(origin: string | null): Record<string, string> {
    if (!origin || !originAllowed(origin)) return {}
    return {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age':       '86400',
      'Vary':                         'Origin',
    }
  }

  function reply(status: number, body: string, origin: string | null, type = 'application/json') {
    return new Response(body, { status, headers: { 'Content-Type': type, ...cors(origin) } })
  }

  const error = (status: number, message: string, origin: string | null) =>
    reply(status, JSON.stringify({ error: message }), origin)

  async function hasWriteAccess(token: string): Promise<boolean> {
    const key = await sha256(token)
    const expiry = accessCache.get(key)
    if (expiry && expiry > now()) return true
    const gh = createGitHubClient({ token, owner: cfg.githubOwner, repo: cfg.githubRepo, fetch: doFetch })
    const result = await gh.checkWriteAccess()
    if (result.ok) accessCache.set(key, now() + ACCESS_TTL_MS)
    return result.ok
  }

  async function twitchToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && twitch && twitch.expiry > now()) return twitch.token
    const url = 'https://id.twitch.tv/oauth2/token?' + new URLSearchParams({
      client_id:     cfg.igdbClientId,
      client_secret: cfg.igdbClientSecret,
      grant_type:    'client_credentials',
    })
    const res = await doFetch(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Twitch token request failed (${res.status})`)
    const data = await res.json()
    twitch = { token: data.access_token, expiry: now() + (data.expires_in - 60) * 1000 }
    return twitch.token
  }

  async function igdb(endpoint: string, body: string, retry = true): Promise<Response> {
    const res = await doFetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID':     cfg.igdbClientId,
        'Authorization': `Bearer ${await twitchToken(!retry)}`,
        'Content-Type':  'text/plain',
      },
      body,
    })
    // Twitch token revoked or expired early: get a fresh one once
    if (res.status === 401 && retry) return igdb(endpoint, body, false)
    return res
  }

  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get('Origin')
    const url    = new URL(req.url)

    if (origin && !originAllowed(origin)) return error(403, 'Origin not allowed', null)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })

    if (req.method === 'GET' && url.pathname === '/') return reply(200, 'ok', origin, 'text/plain')

    const match = url.pathname.match(/^\/igdb\/([a-z_]+)$/)
    if (!match) return error(404, 'Not found', origin)
    if (req.method !== 'POST') return error(405, 'Method not allowed', origin)
    const endpoint = match[1]
    if (!ALLOWED_ENDPOINTS.has(endpoint)) return error(403, 'Endpoint not allowed', origin)

    const auth  = req.headers.get('Authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!token) return error(401, 'Missing GitHub token', origin)
    try {
      if (!(await hasWriteAccess(token))) return error(403, 'Token lacks write access to the repository', origin)
    } catch (e) {
      return error(502, `Could not verify token: ${(e as Error).message}`, origin)
    }

    const body = await req.text()
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return error(413, 'Query too large', origin)

    try {
      const res = await igdb(endpoint, body)
      return reply(res.status, await res.text(), origin)
    } catch (e) {
      return error(502, (e as Error).message, origin)
    }
  }
}

/** Read configuration from environment variables (Deno.env or process.env). */
export function configFromEnv(get: (name: string) => string | undefined): ProxyConfig {
  const required = (name: string) => {
    const v = get(name)
    if (!v) throw new Error(`Missing environment variable ${name}`)
    return v
  }
  return {
    igdbClientId:     required('IGDB_CLIENT_ID'),
    igdbClientSecret: required('IGDB_CLIENT_SECRET'),
    githubOwner:      required('GITHUB_OWNER'),
    githubRepo:       required('GITHUB_REPO'),
    allowedOrigins:   (get('ALLOWED_ORIGIN') ?? '').split(',').map(s => s.trim()).filter(Boolean),
  }
}
