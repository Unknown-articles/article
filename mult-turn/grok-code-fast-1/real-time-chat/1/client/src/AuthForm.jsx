import { useState } from 'react'

function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTabChange = (newMode) => {
    setMode(newMode)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.token, { userId: data.userId, username: data.username })
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit}>
      <button type="button" data-testid="tab-login" onClick={() => handleTabChange('login')}>Login</button>
      <button type="button" data-testid="tab-register" onClick={() => handleTabChange('register')}>Register</button>
      <input data-testid="input-username" type="text" minLength="3" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input data-testid="input-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button data-testid="btn-submit" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Submit'}</button>
      {error && <div data-testid="auth-error">{error}</div>}
    </form>
  )
}

export default AuthForm