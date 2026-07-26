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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username, password } });
      setSession(data.token, data.user);
      navigate(data.mustChangePassword ? '/trocar-senha' : '/', { replace: true });
    } catch (err) {
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="Usuário"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="input-icon">
              <Icon name="lock" size={20} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Senha"
              />
            </div>
          </div>
          <button className="btn" disabled={loading || !username || !password}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="login-version">Versão 1.0.0</div>
      </main>
    </div>
  );
}
