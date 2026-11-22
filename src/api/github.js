/**
 * Minimal GitHub REST client for reading and committing the library files.
 *
 * Saves use the Git Data API so both files land in ONE commit, and the branch
 * ref is moved without force: if another device pushed first the update is not
 * a fast-forward, which we report as a `conflict` error.
 */

const API = 'https://api.github.com'

export class GitHubError extends Error {
  /**
   * @param {string} message
   * @param {'unauthorized'|'forbidden'|'not_found'|'conflict'|'rate_limited'|'network'|'http'} kind
   * @param {number} [status]
   */
  constructor(message, kind, status) {
    super(message)
    this.name   = 'GitHubError'
    this.kind   = kind
    this.status = status
  }
}

function kindFor(status, body) {
  if (status === 401) return 'unauthorized'
  if (status === 403 || status === 429) {
    return /rate limit/i.test(body) ? 'rate_limited' : 'forbidden'
  }
  if (status === 404) return 'not_found'
  return 'http'
}

/**
 * @param {{ token: string, owner: string, repo: string, branch?: string, fetch?: typeof fetch }} opts
 */
export function createGitHubClient({ token, owner, repo, branch = 'main', fetch: fetchImpl = globalThis.fetch }) {
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  async function request(method, path, { body, accept = 'application/vnd.github+json', raw = false } = {}) {
    let res
    try {
      res = await fetchImpl(`${API}${path}`, {
        method,
        // GitHub sends max-age=60 on GETs; we always need the live state
        cache: 'no-store',
        headers: {
          'Accept':               accept,
          'Authorization':        `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      throw new GitHubError(`Network error: ${e.message}`, 'network')
    }
    const text = await res.text()
    if (!res.ok) {
      throw Object.assign(
        new GitHubError(`GitHub ${method} ${path} failed (${res.status})`, kindFor(res.status, text), res.status),
        { body: text },
      )
    }
    if (raw) return text
    return text ? JSON.parse(text) : null
  }

  return {
    /**
     * Check that the token can write to the repository. Fine-grained tokens can
     * report the account's role in `permissions`, so we also make a harmless
     * write: creating an unreferenced blob needs Contents write and changes no
     * branch or file.
     * @returns {Promise<{ ok: true } | { ok: false, reason: 'unauthorized'|'no_repo_access'|'read_only'|'network'|'error', message?: string }>}
     */
    async checkWriteAccess() {
      try {
        const info = await request('GET', repoPath)
        if (info?.permissions && info.permissions.push === false) {
          return { ok: false, reason: 'read_only' }
        }
        await request('POST', `${repoPath}/git/blobs`, {
          body: { content: 'backlogtracker access check', encoding: 'utf-8' },
        })
        return { ok: true }
      } catch (e) {
        if (!(e instanceof GitHubError)) return { ok: false, reason: 'error', message: e.message }
        if (e.kind === 'unauthorized') return { ok: false, reason: 'unauthorized' }
        if (e.kind === 'not_found')    return { ok: false, reason: e.message.includes('/git/blobs') ? 'read_only' : 'no_repo_access' }
        if (e.kind === 'forbidden')    return { ok: false, reason: 'read_only' }
        if (e.kind === 'network')      return { ok: false, reason: 'network' }
        return { ok: false, reason: 'error', message: e.message }
      }
    },

    /** SHA of the latest commit on the branch. */
    async getHeadSha() {
      const ref = await request('GET', `${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`)
      return ref.object.sha
    },

    /**
     * Read text files as they are at `commitSha`. Missing files resolve to null.
     * @param {string} commitSha
     * @param {string[]} paths
     * @returns {Promise<Record<string, string|null>>}
     */
    async readFiles(commitSha, paths) {
      const entries = await Promise.all(paths.map(async p => {
        try {
          const text = await request(
            'GET',
            `${repoPath}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${commitSha}`,
            { accept: 'application/vnd.github.raw+json', raw: true },
          )
          return [p, text]
        } catch (e) {
          if (e instanceof GitHubError && e.kind === 'not_found') return [p, null]
          throw e
        }
      }))
      return Object.fromEntries(entries)
    },

    /**
     * Commit `files` on top of `parentSha` and move the branch to it.
     * Throws GitHubError with kind 'conflict' when the branch has moved on.
     * @param {{ parentSha: string, files: Record<string, string>, message: string }} args
     * @returns {Promise<string>} the new commit's SHA
     */
    async commitFiles({ parentSha, files, message }) {
      const parent = await request('GET', `${repoPath}/git/commits/${parentSha}`)
      const tree = await request('POST', `${repoPath}/git/trees`, {
        body: {
          base_tree: parent.tree.sha,
          tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
        },
      })
      const commit = await request('POST', `${repoPath}/git/commits`, {
        body: { message, tree: tree.sha, parents: [parentSha] },
      })
      try {
        await request('PATCH', `${repoPath}/git/refs/heads/${encodeURIComponent(branch)}`, {
          body: { sha: commit.sha, force: false },
        })
      } catch (e) {
        // 422 "Update is not a fast forward" → someone else pushed first
        if (e instanceof GitHubError && (e.status === 422 || e.status === 409)) {
          throw new GitHubError('Branch moved since last load', 'conflict', e.status)
        }
        throw e
      }
      return commit.sha
    },
  }
}
