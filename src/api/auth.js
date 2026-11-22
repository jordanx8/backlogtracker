/**
 * The owner's GitHub token, kept on this device only. Possession of a token
 * with write access to the repository is what "signed in" means.
 */

const TOKEN_KEY = 'backlog_github_token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}
