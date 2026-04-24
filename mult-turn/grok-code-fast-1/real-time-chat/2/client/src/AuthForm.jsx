import { useState } from 'react'

function LoginForm({ onLogin }) {
  const [formMode, setFormMode] = useState('login')
  const [userName, setUserName] = useState('')
  const [passWord, setPassWord] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const switchTab = (newMode) => {
    setFormMode(newMode)
    setErrMsg('')
  }

  const submitForm = async (e) => {
    e.preventDefault()
    setErrMsg('')
    setIsLoading(true)

    const endpoint = formMode === 'login' ? '/auth/login' : '/auth/register'

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userName, password: passWord })
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.token, { userId: data.userId, username: data.username })
      } else {
        setErrMsg(data.error)
      }
    } catch (err) {
      setErrMsg('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form data-testid="auth-form" data-mode={formMode} onSubmit={submitForm}>
      <button type="button" data-testid="tab-login" onClick={() => switchTab('login')}>Login</button>
      <button type="button" data-testid="tab-register" onClick={() => switchTab('register')}>Register</button>
      <input data-testid="input-username" type="text" minLength="3" value={userName} onChange={(e) => setUserName(e.target.value)} required />
      <input data-testid="input-password" type="password" value={passWord} onChange={(e) => setPassWord(e.target.value)} required />
      <button data-testid="btn-submit" type="submit" disabled={isLoading}>{isLoading ? 'Loading...' : 'Submit'}</button>
      {errMsg && <div data-testid="auth-error">{errMsg}</div>}
    </form>
  )
}

export default LoginForm