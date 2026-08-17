import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession, setSession, getToken } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { avatarColor } from '../lib/avatar';

const roleLabel = { ADMIN: 'Administrador', CABO: 'Cabo eleitoral', SUBCABO: 'Subcabo eleitoral' };
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtShortDate(d) {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function Profile() {
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api('/auth/me').then(setData).catch((e) => setError(e.message));
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api('/auth/me', { method: 'PATCH', body: form });
      setSession(getToken(), res.user);
      setData((d) => ({ ...d, user: res.user }));
      setEditOpen(false);
      setMsg('Perfil atualizado.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePw(e) {
    e.preventDefault();
    setError('');
    if (pwForm.next !== pwForm.confirm) {
      setError('A confirmação de senha não confere.');
      return;
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pwForm.current, newPassword: pwForm.next },
      });
      setPwOpen(false);
      setPwForm({ current: '', next: '', confirm: '' });
      setMsg('Senha alterada com sucesso.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  const u = data?.user;

  return (
    <>
      <AppHeader title="Eleitorando" />
      <div className="page">
        {msg && <div className="alert success">{msg}</div>}
        {error && !editOpen && !pwOpen && <div className="alert error">{error}</div>}
        {!u && <div className="empty">Carregando...</div>}

        {u && (
          <>
            <div className="profile-hero">
              <div
                className="avatar avatar-xl"
                style={{ background: avatarColor(u.name), color: '#fff', borderColor: 'transparent' }}
              >
                {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <h2>{u.name}</h2>
              <span className="profile-role-badge">
                <Icon name="verified" size={14} filled /> {roleLabel[u.role]}
              </span>
            </div>

            <div className="card">
              <h3 className="card-section-heading"><Icon name="person" size={18} /> Dados Pessoais</h3>
              <div className="profile-info-row">
                <Icon name="mail" size={18} className="profile-info-icon" />
                <div>
                  <div className="profile-info-label">E-mail</div>
                  <div className="profile-info-value">{u.email || 'Não informado'}</div>
                </div>
              </div>
              <div className="profile-info-row">
                <Icon name="call" size={18} className="profile-info-icon" />
                <div>
                  <div className="profile-info-label">Telefone</div>
                  <div className="profile-info-value">{u.phone || 'Não informado'}</div>
                </div>
              </div>
              <div className="profile-info-row">
                <Icon name="location_on" size={18} className="profile-info-icon" />
                <div>
                  <div className="profile-info-label">Cidade Base</div>
                  <div className="profile-info-value">{u.city}, {u.state}{u.neighborhood ? ` · ${u.neighborhood}` : ''}</div>
                </div>
              </div>
              {u.parent && (
                <div className="profile-info-row">
                  <Icon name="supervisor_account" size={18} className="profile-info-icon" />
                  <div>
                    <div className="profile-info-label">Cabo responsável</div>
                    <div className="profile-info-value">{u.parent.name}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="card-section-heading"><Icon name="campaign" size={18} /> Atuação na Campanha</h3>
              <div className="card-row" style={{ marginBottom: 14 }}>
                <span className="meta">Início na Equipe</span>
                <span className="chip primary">{fmtShortDate(u.createdAt)}</span>
              </div>
              <div className="profile-stat-box">
                <div className="num">{data.votersCount}</div>
                <div className="label">Cadastros Realizados</div>
              </div>
            </div>

            <div className="list-caption">Ações e Configurações</div>
            <div className="card" style={{ padding: 0 }}>
              <button
                type="button"
                className="profile-action-row"
                onClick={() => { setForm({ name: u.name, phone: u.phone || '', email: u.email || '' }); setError(''); setEditOpen(true); }}
              >
                <Icon name="person_edit" size={20} />
                <span className="profile-action-label">Editar Perfil</span>
                <Icon name="chevron_right" size={20} />
              </button>
              <button type="button" className="profile-action-row" onClick={() => { setError(''); setPwOpen(true); }}>
                <Icon name="lock_reset" size={20} />
                <span className="profile-action-label">Alterar Senha</span>
                <Icon name="chevron_right" size={20} />
              </button>
              <button
                type="button"
                className="profile-action-row danger"
                onClick={() => { clearSession(); navigate('/login'); }}
              >
                <Icon name="logout" size={20} />
                <span className="profile-action-label">Sair da Conta</span>
              </button>
            </div>
          </>
        )}
      </div>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar Perfil">
        <form onSubmit={saveProfile}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Nome completo</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="meta" style={{ marginBottom: 12 }}>
            Perfil de acesso, estado e cidade de atuação só podem ser alterados pelo seu responsável.
          </div>
          <button className="btn">Salvar</button>
        </form>
      </BottomSheet>

      <BottomSheet open={pwOpen} onClose={() => setPwOpen(false)} title="Alterar senha">
        <form onSubmit={changePw}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Senha atual</label>
            <input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
          </div>
          <div className="field">
            <label>Nova senha</label>
            <input type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} placeholder="Deve conter ao menos um número" />
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
          </div>
          <button className="btn" disabled={!pwForm.current || !pwForm.next || !pwForm.confirm}>Alterar senha</button>
        </form>
      </BottomSheet>
    </>
  );
}
