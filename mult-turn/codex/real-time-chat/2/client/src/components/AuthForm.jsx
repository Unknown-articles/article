import { useState } from 'react';

const MODES = {
  login: {
    submitLabel: 'Entrar',
    helper: 'Informe suas credenciais para abrir a sala em tempo real.'
  },
  register: {
    submitLabel: 'Criar acesso',
    helper: 'Defina um usuario e uma senha para iniciar a conversa.'
  }
};

export function AuthForm({ onSubmit }) {
  const [activeMode, setActiveMode] = useState('login');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function switchMode(nextMode) {
    setActiveMode(nextMode);
    setSubmitError('');
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    setSubmitError('');

    const submittedForm = new FormData(event.currentTarget);
    const formPayload = {
      username: submittedForm.get('username'),
      password: submittedForm.get('password')
    };

    try {
      setSubmitting(true);
      await onSubmit(activeMode, formPayload);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="auth-form"
      data-testid="auth-form"
      data-mode={activeMode}
      onSubmit={handleFormSubmit}
    >
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          aria-selected={activeMode === 'login'}
          className="tab-button"
          data-testid="tab-login"
          onClick={() => switchMode('login')}
          role="tab"
          type="button"
        >
          Acessar
        </button>
        <button
          aria-selected={activeMode === 'register'}
          className="tab-button"
          data-testid="tab-register"
          onClick={() => switchMode('register')}
          role="tab"
          type="button"
        >
          Registrar
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

      {submitError ? (
        <p className="auth-error" data-testid="auth-error">
          {submitError}
        </p>
      ) : null}

      <button
        className="submit-button"
        data-testid="btn-submit"
        disabled={submitting}
        type="submit"
      >
        {submitting ? 'Processando...' : MODES[activeMode].submitLabel}
      </button>
      <p className="form-helper">{MODES[activeMode].helper}</p>
    </form>
  );
}
