import { useEffect, useState } from 'react';
import { api, getUser } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import UserForm from '../components/UserForm';
import StateCitySelect from '../components/StateCitySelect';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

const roleLabel = { ADMIN: 'Administrador', CABO: 'Cabo eleitoral', SUBCABO: 'Subcabo eleitoral' };
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

export default function Team() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [allSubcabos, setAllSubcabos] = useState([]);
  const [tab, setTab] = useState('cabos'); // visão admin: cabos | subcabos
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState('CABO');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdInfo, setCreatedInfo] = useState(null); // confirmação com senha inicial

  const [detail, setDetail] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetDone, setResetDone] = useState(null);
  const [actionError, setActionError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [success, setSuccess] = useState('');

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  async function load() {
    try {
      const data = await api('/users');
      setUsers(data.users);
      if (isAdmin) {
        const subs = await api('/users/subcabos');
        setAllSubcabos(subs.users);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(form) {
    setCreating(true);
    setCreateError('');
    try {
      const data = await api('/users', { method: 'POST', body: form });
      setCreateOpen(false);
      setCreatedInfo({ ...data.user, initialPassword: data.initialPassword, message: data.message });
      load();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(id) {
    setActionError('');
    try {
      setDetail(await api(`/users/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActive(u) {
    setActionError('');
    try {
      await api(`/users/${u.id}/status`, { method: 'PATCH', body: { active: !u.active } });
      await openDetail(u.id);
      load();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    setActionError('');
    try {
      await api(`/users/${editUser.id}`, { method: 'PATCH', body: editForm });
      setEditUser(null);
      if (detail) await openDetail(editUser.id);
      load();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleDelete() {
    try {
      const data = await api(`/users/${toDelete.user.id}`, { method: 'DELETE' });
      setToDelete(null);
      setDetail(null);
      flash(data.message);
      load();
    } catch (e) {
      setToDelete(null);
      setError(e.message);
      setTimeout(() => setError(''), 3500);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setActionError('');
    try {
      const data = await api(`/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: { newPassword: resetPw },
      });
      setResetTarget(null);
      setResetPw('');
      setResetDone({ name: resetTarget.name, password: data.initialPassword });
    } catch (err) {
      setActionError(err.message);
    }
  }

  const baseUsers = isAdmin && tab === 'subcabos' ? allSubcabos : users;
  const shownUsers = baseUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <AppHeader title="Equipe" subtitle="Gestão de Lideranças" />
      <div className="page" style={{ paddingBottom: 104 }}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="field search-field">
          <div className="input-icon">
            <Icon name="search" size={20} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membros da equipe..."
              aria-label="Buscar membros da equipe"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="segmented-tabs" role="tablist" aria-label="Tipo de membro">
            <button className={`tab ${tab === 'cabos' ? 'active' : ''}`} onClick={() => setTab('cabos')} role="tab" aria-selected={tab === 'cabos'}>
              Cabos
            </button>
            <button className={`tab ${tab === 'subcabos' ? 'active' : ''}`} onClick={() => setTab('subcabos')} role="tab" aria-selected={tab === 'subcabos'}>
              Subcabos
            </button>
          </div>
        )}

        {shownUsers.length === 0 && (
          <div className="empty">
            <Icon name="group_off" size={36} />
            Nenhum usuário por aqui ainda.
          </div>
        )}

        {shownUsers.map((u, i) => (
          <button
            key={u.id}
            type="button"
            className="card card-button team-card tappable"
            style={{ '--stagger': `${Math.min(i * 40, 360)}ms` }}
            onClick={() => openDetail(u.id)}
          >
            <div className="card-row">
              <div className="card-leading">
                <div className="avatar">{u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                <div className="card-copy">
                  <div className="card-title">{u.name}</div>
                  <div className="chip-row">
                    <span className="badge role">{roleLabel[u.role]}</span>
                    <span className={`badge ${u.active ? 'ok' : 'off'}`}>{u.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </div>
              <Icon name="more_vert" />
            </div>
            <div className="team-card-footer">
              <span className="meta"><Icon name="location_on" size={14} /> {u.neighborhood || u.city}</span>
              <span className="meta">
                <Icon name="group" size={14} />{' '}
                {u.role === 'CABO' ? u.teamVoters : u.votersCount} eleitores
              </span>
            </div>
            {isAdmin && u.role === 'SUBCABO' && u.parent && <div className="meta">Cabo: {u.parent.name}</div>}
          </button>
        ))}
      </div>

      {/* Botão fixo de criação — admin cria cabos e subcabos; cabo cria os próprios subcabos */}
      {(isAdmin || me?.role === 'CABO') && (
        <button
          className="btn fab"
          onClick={() => {
            setCreateError('');
            setCreateRole(isAdmin && tab !== 'subcabos' ? 'CABO' : 'SUBCABO');
            setCreateOpen(true);
          }}
          aria-label={isAdmin && tab !== 'subcabos' ? 'Criar cabo eleitoral' : 'Criar subcabo'}
        >
          <Icon name="add" size={28} />
        </button>
      )}

      {/* Sheet: criação */}
      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createRole === 'SUBCABO' ? 'Criar subcabo' : 'Criar cabo eleitoral'}
      >
        <UserForm
          key={createRole + String(createOpen)}
          role={createRole}
          cabos={users}
          onSubmit={handleCreate}
          submitting={creating}
          error={createError}
          hideParent={!isAdmin}
        />
      </BottomSheet>

      {/* Sheet: confirmação com senha inicial (exibida apenas neste momento) */}
      <BottomSheet open={!!createdInfo} onClose={() => setCreatedInfo(null)} title="Tudo certo! ✅">
        {createdInfo && (
          <>
            <div className="alert success">{createdInfo.message}</div>
            <div className="field">
              <label>Usuário criado</label>
              <input value={createdInfo.username} disabled />
            </div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Senha inicial</label>
            <div className="password-box">{createdInfo.initialPassword}</div>
            <div className="meta" style={{ marginBottom: 12 }}>
              Esta senha só aparece agora. O usuário deverá trocá-la no primeiro acesso.
            </div>
            <div className="row-actions">
              <button
                className="btn secondary"
                onClick={() => navigator.clipboard?.writeText(`Usuário: ${createdInfo.username}\nSenha: ${createdInfo.initialPassword}`)}
              >
                Copiar acesso
              </button>
              <button className="btn" onClick={() => setCreatedInfo(null)}>Concluir</button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Sheet: detalhe do usuário */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail?.user?.name}>
        {detail && (
          <>
            {actionError && <div className="alert error">{actionError}</div>}
            <div className="chip-row" style={{ marginBottom: 12 }}>
              <span className="badge role">{roleLabel[detail.user.role]}</span>
              <span className={`badge ${detail.user.active ? 'ok' : 'off'}`}>{detail.user.active ? 'Ativa' : 'Inativa'}</span>
            </div>
            <div className="card">
              <div className="meta">📍 Atuação: {detail.user.city}/{detail.user.state}{detail.user.neighborhood ? ` · ${detail.user.neighborhood}` : ''}</div>
              {(detail.user.zone || detail.user.section) && (
                <div className="meta">
                  🗳️ {detail.user.zone ? `Zona ${detail.user.zone}` : ''}{detail.user.zone && detail.user.section ? ' · ' : ''}{detail.user.section ? `Seção ${detail.user.section}` : ''}
                </div>
              )}
              <div className="meta">👤 Usuário: {detail.user.username}</div>
              {detail.user.phone && <div className="meta">📞 {detail.user.phone}</div>}
              {detail.parent && <div className="meta">🧭 Cabo responsável: {detail.parent.name}</div>}
              <div className="meta">🗓️ Criado em {fmtDate(detail.user.createdAt)}</div>
            </div>

            <div className="stats-grid">
              <div className="stat"><div className="num">{detail.ownVoters}</div><div className="label">Registros próprios</div></div>
              <div className="stat"><div className="num">{detail.teamVoters}</div><div className="label">Registros dos subcabos</div></div>
            </div>

            {detail.subcabos.length > 0 && (
              <>
                <div className="section-title">Subcabos vinculados</div>
                <div className="card list-divided">
                  {detail.subcabos.map((s) => (
                    <div key={s.id} className="card-row">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                        <div className="meta">{s.city}/{s.state} · {s.votersCount} eleitores</div>
                      </div>
                      <span className={`badge ${s.active ? 'ok' : 'off'}`}>{s.active ? 'Ativa' : 'Inativa'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.recentVoters.length > 0 && (
              <>
                <div className="section-title">Últimos cadastros da equipe</div>
                <div className="card list-divided">
                  {detail.recentVoters.map((v) => (
                    <div key={v.id}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.name}</div>
                      <div className="meta">{v.city}/{v.state} · por {v.createdBy.name} · {fmtDate(v.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="section-title">Ações</div>
            <div className="row-actions" style={{ marginTop: 0 }}>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditForm({
                    name: detail.user.name,
                    phone: detail.user.phone || '',
                    state: detail.user.state,
                    city: detail.user.city,
                    neighborhood: detail.user.neighborhood || '',
                    zone: detail.user.zone || '',
                    section: detail.user.section || '',
                  });
                  setEditUser(detail.user);
                }}
              >
                Editar dados
              </button>
              <button className="btn secondary" onClick={() => { setResetPw(''); setResetTarget(detail.user); }}>
                Redefinir senha
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                className={`btn ${detail.user.active ? 'danger-outline' : ''}`}
                onClick={() => toggleActive(detail.user)}
              >
                {detail.user.active ? 'Desativar conta' : 'Ativar conta'}
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn danger-outline" onClick={() => setToDelete(detail)}>
                Excluir {detail.user.role === 'CABO' ? 'cabo eleitoral' : 'subcabo'}
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Sheet: edição */}
      <BottomSheet open={!!editUser} onClose={() => setEditUser(null)} title={`Editar ${editUser?.name || ''}`}>
        {editUser && editForm && (
          <form onSubmit={handleEdit}>
            {actionError && <div className="alert error">{actionError}</div>}
            <div className="field">
              <label>Nome completo <span className="req">*</span></label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <StateCitySelect
              state={editForm.state}
              city={editForm.city}
              onChange={({ state, city }) => setEditForm({ ...editForm, state, city })}
            />
            <div className="field">
              <label>Bairro principal</label>
              <input
                value={editForm.neighborhood}
                onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="row-actions" style={{ marginTop: 0 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Zona eleitoral</label>
                <input
                  inputMode="numeric"
                  value={editForm.zone}
                  onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                  placeholder="Ex.: 012"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Seção</label>
                <input
                  inputMode="numeric"
                  value={editForm.section}
                  onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                  placeholder="Ex.: 0345"
                />
              </div>
            </div>
            <button className="btn" disabled={!editForm.name.trim() || !editForm.state || !editForm.city}>
              Salvar alterações
            </button>
          </form>
        )}
      </BottomSheet>

      {/* Sheet: redefinir senha */}
      <BottomSheet open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Redefinir senha de ${resetTarget?.name || ''}`}>
        {resetTarget && (
          <form onSubmit={handleReset}>
            {actionError && <div className="alert error">{actionError}</div>}
            <div className="field">
              <label>Nova senha inicial <span className="req">*</span></label>
              <input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Mínimo 8 caracteres, letras e números"
              />
              <div className="hint">O usuário deverá trocar a senha no próximo acesso.</div>
            </div>
            <button className="btn" disabled={!resetPw}>Redefinir senha</button>
          </form>
        )}
      </BottomSheet>

      {/* Sheet: confirmação de redefinição */}
      <BottomSheet open={!!resetDone} onClose={() => setResetDone(null)} title="Senha redefinida ✅">
        {resetDone && (
          <>
            <div className="alert success">Nova senha de {resetDone.name} criada com sucesso.</div>
            <div className="password-box">{resetDone.password}</div>
            <div className="row-actions">
              <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(resetDone.password)}>
                Copiar senha
              </button>
              <button className="btn" onClick={() => setResetDone(null)}>Concluir</button>
            </div>
          </>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={`Excluir ${toDelete?.user?.role === 'CABO' ? 'cabo eleitoral' : 'subcabo'}?`}
        description={
          <>
            <b>{toDelete?.user?.name}</b> será removido da equipe e não conseguirá mais acessar o sistema.
            {toDelete?.subcabos?.length > 0 && (
              <> Os {toDelete.subcabos.length} subcabo{toDelete.subcabos.length === 1 ? '' : 's'} vinculado{toDelete.subcabos.length === 1 ? '' : 's'} a ele{' '}
              continuar{toDelete.subcabos.length === 1 ? 'á' : 'ão'} ativo{toDelete.subcabos.length === 1 ? '' : 's'}, mas sem esse cabo responsável visível.</>
            )}
            {' '}Os eleitores já cadastrados por essa pessoa não são apagados.
          </>
        }
      />
    </>
  );
}
