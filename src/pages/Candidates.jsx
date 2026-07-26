import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, apiUpload, getUser, assetUrl } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import CandidateForm from '../components/CandidateForm';

export default function Candidates() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';
  const isCabo = me?.role === 'CABO';
  const canManage = isAdmin || isCabo;

  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [editTarget, setEditTarget] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    try {
      const data = await api('/candidates');
      setCandidates(data.candidates);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (canManage) load();
  }, [canManage]);

  if (!canManage) return <Navigate to="/" replace />;

  async function handleCreate(formData) {
    setSaving(true);
    setFormError('');
    try {
      const data = await apiUpload('/candidates', formData);
      setCreateOpen(false);
      load();
      return data;
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(formData) {
    setSaving(true);
    setFormError('');
    try {
      await apiUpload(`/candidates/${editTarget.id}`, formData, { method: 'PATCH' });
      setEditTarget(null);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api(`/candidates/${toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      load();
    } catch (e) {
      setToDelete(null);
      setError(e.message);
      setTimeout(() => setError(''), 3500);
    }
  }

  return (
    <>
      <AppHeader title="Candidatos" subtitle="Referência de Intenção de Voto" back />
      <div className="page" style={{ paddingBottom: 104 }}>
        {error && <div className="alert error">{error}</div>}

        {candidates.length === 0 && (
          <div className="empty">
            <Icon name="how_to_vote" size={36} />
            Nenhum candidato cadastrado ainda.
          </div>
        )}

        {candidates.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="card card-button candidate-card tappable"
            style={{ '--stagger': `${Math.min(i * 40, 360)}ms` }}
            onClick={() => { setFormError(''); setEditTarget(c); }}
          >
            <div className="card-row">
              <div className="card-leading">
                <div className="avatar candidate-avatar">
                  {c.photoUrl ? <img src={assetUrl(c.photoUrl)} alt="" /> : c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="card-copy">
                  <div className="card-title">{c.name}</div>
                  <div className="chip-row">
                    <span className="badge role">{c.party}</span>
                    <span className={`badge ${c.active ? 'ok' : 'off'}`}>{c.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </div>
              <Icon name="chevron_right" />
            </div>
          </button>
        ))}
      </div>

      {isAdmin && (
        <button className="btn fab" onClick={() => { setFormError(''); setCreateOpen(true); }} aria-label="Cadastrar candidato">
          <Icon name="add" size={28} />
        </button>
      )}

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Cadastrar candidato">
        <CandidateForm onSubmit={handleCreate} submitting={saving} error={formError} />
      </BottomSheet>

      <BottomSheet open={!!editTarget} onClose={() => setEditTarget(null)} title={`Editar ${editTarget?.name || ''}`}>
        {editTarget && (
          <>
            <CandidateForm candidate={editTarget} onSubmit={handleEdit} submitting={saving} error={formError} />
            <button
              className="btn danger-outline"
              style={{ marginTop: 12 }}
              onClick={() => { setEditTarget(null); setToDelete(editTarget); }}
            >
              Excluir candidato
            </button>
          </>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Candidato?"
        description={
          <>
            O candidato <b>{toDelete?.name}</b> ({toDelete?.party}) será removido. Eleitores que apontavam
            intenção de voto para ele ficarão sem candidato definido.
          </>
        }
      />
    </>
  );
}
