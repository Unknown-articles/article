import { useState } from 'react'

function SignInForm({ onLogin }) {
  const [currentMode, setCurrentMode] = useState('login')
  const [loginName, setLoginName] = useState('')
  const [secret, setSecret] = useState('')
  const [issue, setIssue] = useState('')
  const [processing, setProcessing] = useState(false)

  const changeMode = (newMode) => {
    setCurrentMode(newMode)
    setIssue('')
  }

  const processSubmit = async (e) => {
    e.preventDefault()
    setIssue('')
    setProcessing(true)

    const endpoint = currentMode === 'login' ? '/auth/login' : '/auth/register'

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginName, password: secret })
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.token, { userId: data.userId, username: data.username })
      } else {
        setIssue(data.error)
      }
    } catch (err) {
      setIssue('Network error')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form data-testid="auth-form" data-mode={currentMode} onSubmit={processSubmit}>
      <button type="button" data-testid="tab-login" onClick={() => changeMode('login')}>Sign In</button>
      <button type="button" data-testid="tab-register" onClick={() => changeMode('register')}>Sign Up</button>
      <input data-testid="input-username" type="text" minLength="3" value={loginName} onChange={(e) => setLoginName(e.target.value)} required />
      <input data-testid="input-password" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
      <button data-testid="btn-submit" type="submit" disabled={processing}>{processing ? 'Loading...' : 'Submit'}</button>
      {issue && <div data-testid="auth-error">{issue}</div>}
    </form>
  )
}

export default SignInForm