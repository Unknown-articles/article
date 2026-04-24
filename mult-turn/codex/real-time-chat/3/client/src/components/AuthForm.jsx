import { useState } from 'react';

const MODES = {
  login: {
    submitLabel: 'Join chat',
    helper: 'Use your registered account to reconnect instantly.'
  },
  register: {
    submitLabel: 'Open account',
    helper: 'Pick a username and password to create your access.'
  }
};

export function AuthForm({ onSubmit }) {
  const [currentMode, setCurrentMode] = useState('login');
  const [feedback, setFeedback] = useState('');
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function switchMode(nextMode) {
    setCurrentMode(nextMode);
    setFeedback('');
  }

  async function submitForm(event) {
    event.preventDefault();
    setFeedback('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password')
    };

    try {
      setPendingSubmit(true);
      await onSubmit(currentMode, payload);
    } catch (submitError) {
      setFeedback(submitError.message);
    } finally {
      setPendingSubmit(false);
    }
  }

  return (
    <form
      className="auth-form"
      data-testid="auth-form"
      data-mode={currentMode}
      onSubmit={submitForm}
    >
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          aria-selected={currentMode === 'login'}
          className="tab-button"
          data-testid="tab-login"
          onClick={() => switchMode('login')}
          role="tab"
          type="button"
        >
          Login
        </button>
        <button
          aria-selected={currentMode === 'register'}
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

      {feedback ? (
        <p className="auth-error" data-testid="auth-error">
          {feedback}
        </p>
      ) : null}

      <button
        className="submit-button"
        data-testid="btn-submit"
        disabled={pendingSubmit}
        type="submit"
      >
        {pendingSubmit ? 'Please wait...' : MODES[currentMode].submitLabel}
      </button>
      <p className="form-helper">{MODES[currentMode].helper}</p>
    </form>
  );
}
