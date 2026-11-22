import { useState } from 'react'
import Icon from './Icon'
import { config } from '../config'
import { githubClient } from '../api/storage'

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

function reasonMessage(result) {
  const repo = `${config.owner}/${config.repo}`
  switch (result.reason) {
    case 'unauthorized':   return "GitHub didn't accept this token. Check that it was copied in full and hasn't expired."
    case 'no_repo_access': return `This token can't see ${repo}. Under "Repository access", choose "Only select repositories" and pick ${config.repo}.`
    case 'read_only':      return `This token can read ${repo} but not change it. Under "Repository permissions", set Contents to "Read and write".`
    case 'network':        return "Couldn't reach GitHub. Check your connection and try again."
    default:               return `Couldn't check the token${result.message ? `: ${result.message}` : '.'}`
  }
}

export default function SignIn({ onSignedIn, notice }) {
  const [token, setToken]     = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError]     = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const value = token.trim()
    if (!value) return
    setChecking(true)
    setError('')
    const result = await githubClient(value).checkWriteAccess()
    setChecking(false)
    if (result.ok) onSignedIn(value)
    else setError(reasonMessage(result))
  }

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit}>
        <div className="signin-title">
          <Icon name="gamepad" size={22} style={{ color: 'var(--color-accent)' }} />
          <h1>Backlog Tracker</h1>
        </div>

        {notice && <p className="signin-notice">{notice}</p>}

        <p className="signin-lead">
          Sign in with a GitHub token that can write to <code>{config.owner}/{config.repo}</code>.
          The token stays on this device.
        </p>

        <div className="field">
          <label htmlFor="signin-token">GitHub token</label>
          <input
            id="signin-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            value={token}
            onChange={e => setToken(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error" role="alert">{error}</p>}
        </div>

        <button className="btn-primary signin-submit" type="submit" disabled={checking || !token.trim()}>
          {checking ? 'Checking…' : 'Sign in'}
        </button>

        <details className="signin-help">
          <summary>How to create a token</summary>
          <ol>
            <li>Open <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">GitHub → New fine-grained token</a>.</li>
            <li>Give it a name and an expiration (up to a year).</li>
            <li>Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick <b>{config.repo}</b>.</li>
            <li>Under <b>Repository permissions</b>, set <b>Contents</b> to <b>Read and write</b>.</li>
            <li>Generate the token, copy it, and paste it above.</li>
          </ol>
          <p>Repeat on each device, or reuse the same token. You can revoke it on GitHub at any time.</p>
        </details>
      </form>
    </div>
  )
}

export function ConfigMissing({ missing }) {
  return (
    <div className="signin">
      <div className="signin-card">
        <h1>Not configured</h1>
        <p className="signin-lead">
          This build is missing {missing.join(', ')}. Set them in <code>.env.local</code> for
          local development, or as repository variables for the GitHub Pages build.
        </p>
      </div>
    </div>
  )
}
