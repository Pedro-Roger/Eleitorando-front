import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../lib/api';
import Icon from '../components/Icon';
import logo from '../assets/logo-eleitorando.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debugTrail = (() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return [];
    try {
      return JSON.parse(sessionStorage.getItem('authDebugTrail') || '[]');
    } catch {
      return [];
    }
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const submittedUsername = String(form.get('username') || '').trim();
    const submittedPassword = String(form.get('password') || '');
    if (!submittedUsername || !submittedPassword) {
      setError('Informe usuário e senha.');
      return;
    }
    setError('');
    setLoading(true);
    console.log('[login] submit', {
      at: new Date().toISOString(),
      username: submittedUsername,
      passwordLength: submittedPassword.length,
      requestUrl: '/api/auth/login',
    });
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username: submittedUsername, password: submittedPassword } });
      console.log('[login] success', {
        at: new Date().toISOString(),
        username: submittedUsername,
        mustChangePassword: data.mustChangePassword,
        role: data.user?.role,
      });
      setSession(data.token, data.user);
      navigate(data.mustChangePassword ? '/trocar-senha' : '/', { replace: true });
    } catch (err) {
      console.error('[login] failure', {
        at: new Date().toISOString(),
        username: submittedUsername,
        passwordLength: submittedPassword.length,
        requestUrl: err.url || '/api/auth/login',
        status: err.status || null,
        message: err.message,
        payload: err.payload || null,
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <main className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Eleitorando" className="login-logo-img" />
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <div className="input-icon">
              <Icon name="person" size={20} />
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onInput={(e) => setUsername(e.currentTarget.value)}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="Usuário"
                type="text"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="input-icon">
              <Icon name="lock" size={20} />
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onInput={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                placeholder="Senha"
                required
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        {import.meta.env.DEV && debugTrail.length > 0 && (
          <pre className="login-debug">{JSON.stringify(debugTrail, null, 2)}</pre>
        )}
        <div className="login-version">Versão 1.0.0</div>
      </main>
    </div>
  );
}
