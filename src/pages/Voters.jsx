import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getUser } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import VoterForm from '../components/VoterForm';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { avatarColor } from '../lib/avatar';

function locationLine(v) {
  return v.neighborhood || v.city || 'Sem localização';
}

export default function Voters() {
  const me = getUser();
  const [voters, setVoters] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const [actionTarget, setActionTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [dupPhone, setDupPhone] = useState(false);

  // Filtro por equipe: admin filtra por cabo e subcabo; cabo filtra pelos próprios subcabos
  const [caboFilter, setCaboFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [cabosTree, setCabosTree] = useState([]); // admin: cabos com subcabos
  const [mySubs, setMySubs] = useState([]); // cabo: seus subcabos

  useEffect(() => {
    if (me?.role === 'ADMIN') api('/export/options').then((d) => setCabosTree(d.cabos)).catch(() => {});
    else if (me?.role === 'CABO') api('/users').then((d) => setMySubs(d.users)).catch(() => {});
  }, []);

  // Subcabos exibidos no filtro do admin: todos, ou só os do cabo escolhido
  const adminSubOptions = useMemo(() => {
    const cabos = caboFilter ? cabosTree.filter((c) => c.id === Number(caboFilter)) : cabosTree;
    return cabos.flatMap((c) => c.subcabos.map((s) => ({ ...s, caboName: c.name })));
  }, [cabosTree, caboFilter]);

  // Lista final de cadastradores para o filtro (vazia = sem filtro)
  const teamIds = useMemo(() => {
    if (me?.role === 'ADMIN') {
      if (subFilter) return [Number(subFilter)];
      if (caboFilter) {
        const cabo = cabosTree.find((c) => c.id === Number(caboFilter));
        return cabo ? [cabo.id, ...cabo.subcabos.map((s) => s.id)] : [];
      }
      return [];
    }
    if (me?.role === 'CABO') {
      if (subFilter === 'me') return [me.id];
      if (subFilter) return [Number(subFilter)];
    }
    return [];
  }, [me?.role, me?.id, caboFilter, subFilter, cabosTree]);

  const loadRequest = useRef(0);

  async function load(q = '', ids = teamIds) {
    const requestId = ++loadRequest.current;
    try {
      const p = new URLSearchParams();
      if (q) p.set('search', q);
      if (ids.length) p.set('createdByIds', ids.join(','));
      const qs = p.toString();
      const data = await api(`/voters${qs ? `?${qs}` : ''}`);
      if (requestId !== loadRequest.current) return;
      setVoters(data.voters);
      setTotal(data.total);
    } catch (e) {
      if (requestId !== loadRequest.current) return;
      setError(e.message);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, teamIds]);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  async function handleCreate(formValues) {
    setSaving(true);
    setFormError('');
    try {
      const data = await api('/voters', { method: 'POST', body: formValues });
      setOpen(false);
      flash(data.message);
      load(search);
    } catch (err) {
      if (err.status === 409) setDupPhone(true);
      else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(formValues) {
    setEditSaving(true);
    setEditError('');
    try {
      const data = await api(`/voters/${editTarget.id}`, { method: 'PATCH', body: formValues });
      setEditTarget(null);
      flash(data.message);
      load(search);
    } catch (err) {
      if (err.status === 409) setDupPhone(true);
      else setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const data = await api(`/voters/${toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      flash(data.message);
      load(search);
    } catch (err) {
      setToDelete(null);
      setError(err.message);
      setTimeout(() => setError(''), 3500);
    }
  }

  return (
    <>
      <AppHeader title="Eleitores" subtitle={`${total} cadastro${total === 1 ? '' : 's'}`} />
      <div className="page" style={{ paddingBottom: 104 }}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="field search-field">
          <div className="input-icon">
            <Icon name="search" size={20} />
            <input
              placeholder="Buscar eleitor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {me?.role === 'ADMIN' && cabosTree.length > 0 && (
          <div className="row-actions" style={{ marginTop: 0, marginBottom: 4 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Cabo</label>
              <select value={caboFilter} onChange={(e) => { setCaboFilter(e.target.value); setSubFilter(''); }}>
                <option value="">Todos</option>
                {cabosTree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Subcabo</label>
              <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                <option value="">Todos</option>
                {adminSubOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {me?.role === 'CABO' && mySubs.length > 0 && (
          <div className="field">
            <label>Filtrar por membro da equipe</label>
            <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
              <option value="">Toda a equipe</option>
              <option value="me">Meus cadastros</option>
              {mySubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {voters.length === 0 && (
          <div className="empty">
            <Icon name="person_search" size={36} />
            Nenhum eleitor encontrado.
          </div>
        )}

        {voters.map((v, i) => (
          <article key={v.id} className="card voter-card" style={{ '--stagger': `${Math.min(i * 40, 360)}ms` }}>
            <div className="card-row">
              <div className="card-leading">
                <div className="avatar" style={{ background: avatarColor(v.name), color: '#fff', borderColor: 'transparent' }}>
                  {(v.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="card-copy">
                  <div className="card-title">{v.name || 'Sem nome'}</div>
                  <div className="meta"><Icon name="location_on" size={14} /> {locationLine(v)}</div>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setActionTarget(v)}
                aria-label={`Mais opções de ${v.name || 'eleitor sem nome'}`}
              >
                <Icon name="more_vert" size={20} />
              </button>
            </div>
            <div className="chip-row">
              {v.phone && <span className="chip"><Icon name="call" size={12} />{v.phone}</span>}
              {v.age != null && <span className="chip">{v.age} anos</span>}
              {v.zone && <span className="chip primary"><Icon name="how_to_vote" size={12} />Zona {v.zone}</span>}
              {v.section && <span className="chip primary"><Icon name="pin" size={12} />Seção {v.section}</span>}
              {(!v.zone || !v.section) && (
                <span className="chip warn">
                  <Icon name="error" size={12} />
                  {!v.zone && !v.section ? 'Sem zona e seção' : !v.zone ? 'Sem zona' : 'Sem seção'}
                </span>
              )}
            </div>
            <div className="card-footer meta">
              <Icon name="person" size={14} /> Cadastrado por: {me?.role !== 'SUBCABO' ? v.createdBy?.name : 'você'}
            </div>
          </article>
        ))}
      </div>

      <button
        className="btn fab"
        onClick={() => { setFormError(''); setOpen(true); }}
        aria-label="Cadastrar eleitor"
      >
        <Icon name="add" size={28} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Novo Eleitor">
        <VoterForm onSubmit={handleCreate} submitting={saving} error={formError} submitLabel="Salvar Cadastro" />
      </BottomSheet>

      {/* Menu de ações do cartão — Editar / Excluir */}
      <BottomSheet open={!!actionTarget} onClose={() => setActionTarget(null)} title={actionTarget?.name}>
        <div className="card" style={{ padding: 0 }}>
          <button
            type="button"
            className="profile-action-row"
            onClick={() => {
              const target = actionTarget;
              setActionTarget(null);
              setEditError('');
              setEditTarget(target);
            }}
          >
            <Icon name="edit" size={20} />
            <span className="profile-action-label">Editar</span>
            <Icon name="chevron_right" size={20} />
          </button>
          <button
            type="button"
            className="profile-action-row danger"
            onClick={() => {
              const target = actionTarget;
              setActionTarget(null);
              setToDelete(target);
            }}
          >
            <Icon name="delete" size={20} />
            <span className="profile-action-label">Excluir</span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Eleitor">
        {editTarget && (
          <VoterForm
            key={editTarget.id}
            initial={editTarget}
            onSubmit={handleEditSubmit}
            submitting={editSaving}
            error={editError}
            submitLabel="Salvar Alterações"
          />
        )}
      </BottomSheet>

      <AlertDialog
        open={dupPhone}
        onClose={() => setDupPhone(false)}
        title="Telefone já cadastrado"
        description="Já existe um eleitor cadastrado com este número de telefone. Verifique o número ou procure o eleitor na busca."
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Eleitor?"
        description={<>Tem certeza que deseja excluir o cadastro de <b>{toDelete?.name}</b>? Esta ação não poderá ser desfeita.</>}
      />
    </>
  );
}
