import { useState } from 'react'
import App from './App'
import SignIn, { ConfigMissing } from './components/SignIn'
import { getToken, setToken, clearToken } from './api/auth'
import { missingConfig } from './config'

/** Gate: nothing from the library is shown until a write-capable token is stored. */
export default function Root() {
  const [token, setTokenState] = useState(getToken)
  const [notice, setNotice]    = useState('')

  if (missingConfig.length) return <ConfigMissing missing={missingConfig} />

  if (!token) {
    return (
      <SignIn
        notice={notice}
        onSignedIn={t => { setToken(t); setNotice(''); setTokenState(t) }}
      />
    )
  }

  return (
    <App
      key={token}
      token={token}
      onSignOut={() => { clearToken(); setNotice(''); setTokenState(null) }}
      onUnauthorized={() => {
        // Keep unsaved edits on the device; they are saved after signing in again
        clearToken()
        setNotice('GitHub no longer accepts the saved token. Sign in again; any unsaved changes are kept on this device.')
        setTokenState(null)
      }}
    />
  )
}
