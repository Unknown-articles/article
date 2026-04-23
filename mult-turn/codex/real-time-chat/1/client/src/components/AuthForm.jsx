import { useState } from 'react';

const MODES = {
  login: {
    submitLabel: 'Log in',
    helper: 'Use your username and password to enter the chat.'
  },
  register: {
    submitLabel: 'Create account',
    helper: 'Choose a username and password to get started.'
  }
};

export function AuthForm({ onSubmit }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);
    const credentials = {
      username: formData.get('username'),
      password: formData.get('password')
    };

    try {
      setIsSubmitting(true);
      await onSubmit(mode, credentials);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="auth-form"
      data-testid="auth-form"
      data-mode={mode}
      onSubmit={handleSubmit}
    >
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          aria-selected={mode === 'login'}
          className="tab-button"
          data-testid="tab-login"
          onClick={() => switchMode('login')}
          role="tab"
          type="button"
        >
          Login
        </button>
        <button
          aria-selected={mode === 'register'}
          className="tab-button"
          data-testid="tab-register"
          onClick={() => switchMode('register')}
          role="tab"
          type="button"
        >
          Register
        </button>
      </div>

      <div className="field-group">
        <label htmlFor="username">Username</label>
        <input
          autoComplete="username"
          data-testid="input-username"
          id="username"
          minLength="3"
          name="username"
          required
          type="text"
        />
      </div>

      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          data-testid="input-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {error ? (
        <p className="auth-error" data-testid="auth-error">
          {error}
        </p>
      ) : null}

      <button
        className="submit-button"
        data-testid="btn-submit"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Working...' : MODES[mode].submitLabel}
      </button>
      <p className="form-helper">{MODES[mode].helper}</p>
    </form>
  );
}
