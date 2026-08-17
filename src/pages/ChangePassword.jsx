import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Icon from '../components/Icon';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('A confirmação de senha não confere.');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      navigate('/', { replace: true });
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
          <div className="mark"><Icon name="lock_reset" filled size={32} /></div>
          <h1>Trocar senha</h1>
          <p>Defina uma nova senha antes de continuar</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Senha atual</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Deve conter ao menos um número"
            />
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn" disabled={loading || !current || !next || !confirm}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </main>
    </div>
  );
}
