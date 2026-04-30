import { useState } from 'react'

export default function AuthForm({ onSubmit, onModeChange, error }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleModeSwitch = (nextMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    if (typeof onModeChange === 'function') {
      onModeChange()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(mode, username.trim(), password)
  }

  return (
    <div className="auth-shell">
      <div className="auth-tabs">
        <button
          type="button"
          data-testid="tab-login"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => handleModeSwitch('login')}
        >
          Login
        </button>
        <button
          type="button"
          data-testid="tab-register"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => handleModeSwitch('register')}
        >
          Register
        </button>
      </div>

      <form
        data-testid="auth-form"
        data-mode={mode}
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label>
          Username
          <input
            data-testid="input-username"
            type="text"
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            data-testid="input-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button data-testid="btn-submit" type="submit" className="primary-button">
          {mode === 'login' ? 'Login' : 'Register'}
        </button>

        {error ? (
          <div data-testid="auth-error" className="form-error">
            {error}
          </div>
        ) : null}
      </form>
    </div>
  )
}
