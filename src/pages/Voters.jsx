import { useEffect, useRef, useState } from 'react';
import { api, getUser } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import VoterForm from '../components/VoterForm';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { avatarColor } from '../lib/avatar';

function locationLine(v) {
  const place = v.neighborhood || v.city;
  return v.section ? `${place} • Sec. ${v.section}` : place;
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

  const [candidates, setCandidates] = useState([]);
  const loadRequest = useRef(0);

  useEffect(() => {
    api('/candidates').then((d) => setCandidates(d.candidates.filter((c) => c.active))).catch(() => {});
  }, []);

  async function load(q = '') {
    const requestId = ++loadRequest.current;
    try {
      const data = await api(`/voters${q ? `?search=${encodeURIComponent(q)}` : ''}`);
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
  }, [search]);

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
      setFormError(err.message);
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
      setEditError(err.message);
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
                  {v.name.charAt(0).toUpperCase()}
                </div>
                <div className="card-copy">
                  <div className="card-title">{v.name}</div>
                  <div className="meta"><Icon name="location_on" size={14} /> {locationLine(v)}</div>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setActionTarget(v)}
                aria-label={`Mais opções de ${v.name}`}
              >
                <Icon name="more_vert" size={20} />
              </button>
            </div>
            <div className="chip-row">
              {v.phone && <span className="chip"><Icon name="call" size={12} />{v.phone}</span>}
              {v.age != null && <span className="chip">{v.age} anos</span>}
            </div>
            {v.candidate && (
              <div className="voter-candidate">
                <div className="avatar candidate-avatar small">
                  {v.candidate.photoUrl ? <img src={v.candidate.photoUrl} alt="" /> : v.candidate.name.slice(0, 2).toUpperCase()}
                </div>
                <span><Icon name="how_to_vote" size={14} /> Intenção: <b>{v.candidate.name}</b> ({v.candidate.party})</span>
              </div>
            )}
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
        <VoterForm candidates={candidates} onSubmit={handleCreate} submitting={saving} error={formError} submitLabel="Salvar Cadastro" />
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
            candidates={candidates}
            onSubmit={handleEditSubmit}
            submitting={editSaving}
            error={editError}
            submitLabel="Salvar Alterações"
          />
        )}
      </BottomSheet>

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
