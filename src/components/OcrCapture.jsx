import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../lib/api';
import Icon from './Icon';
import BottomSheet from './BottomSheet';

const STATUS_ICONS = {
  uploading: 'hourglass_top',
  queued: 'hourglass_top',
  processing: 'sync',
  done: 'task_alt',
  applied: 'check_circle',
  error: 'error',
};

const STATUS_LABELS = {
  uploading: 'Enviando...',
  queued: 'Na fila...',
  processing: 'Processando...',
  done: 'Pronto — confirme',
  applied: 'Confirmado',
  error: 'Erro',
};

export default function OcrCapture({ open, onClose, onResult, file }) {
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [error, setError] = useState('');
  const [listSelected, setListSelected] = useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const inputRef = useRef(null);
  const counterRef = useRef(0);
  const appliedRef = useRef(new Set());

  const activeJob = jobs.find((j) => j.jobId === activeJobId);
  const busy = activeJob && ['uploading', 'queued', 'processing'].includes(activeJob.status);

  function updateJob(jobId, updates) {
    setJobs((prev) =>
      prev.map((j) => (j.jobId === jobId ? { ...j, ...updates } : j)),
    );
  }

  function addFile(file) {
    if (!file) return;
    setError('');
    counterRef.current += 1;
    const tempId = `tmp_${Date.now()}_${counterRef.current}`;
    setJobs((prev) => [
      ...prev,
      { jobId: tempId, status: 'uploading', filename: file.name, image: null, parsed: null, voters: null, aiUsed: false, error: null, applied: false },
    ]);
    setActiveJobId(tempId);
    setListSelected({});
    setEditingIdx(null);
    setEditDraft(null);

    if (file.type === 'application/pdf') {
      uploadJob(tempId, file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        updateJob(tempId, { image: ev.target.result });
        uploadJob(tempId, file);
      };
      reader.onerror = () => {
        setError('Erro ao ler o arquivo selecionado.');
        updateJob(tempId, { status: 'error', error: 'Erro ao ler o arquivo selecionado.' });
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadJob(tempId, file) {
    try {
      updateJob(tempId, { status: 'queued' });
      const formData = new FormData();
      formData.append('file', file);
      const d = await apiUpload('/ocr/jobs', formData);
      updateJob(tempId, { jobId: d.jobId, status: 'queued' });
      setActiveJobId((cur) => (cur === tempId ? d.jobId : cur));
    } catch (err) {
      updateJob(tempId, { status: 'error', error: err.message });
    }
  }

  // arquivo vindo do input externo da página (compatibilidade)
  useEffect(() => {
    if (file) addFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // polling de TODOS os jobs pendentes (não só o ativo)
  useEffect(() => {
    const pending = jobs.filter(
      (j) => typeof j.jobId === 'number' && (j.status === 'queued' || j.status === 'processing'),
    );
    if (!pending.length) return undefined;

    const timer = setInterval(async () => {
      for (const targetJob of pending) {
        try {
          const d = await api(`/ocr/jobs/${targetJob.jobId}`);
          const st = d.job?.status;
          if (st === 'processing') {
            updateJob(targetJob.jobId, { status: 'processing' });
          } else if (st === 'done') {
            const voters = Array.isArray(d.job.result?.voters) ? d.job.result.voters : null;
            updateJob(targetJob.jobId, {
              status: 'done',
              parsed: d.job.result?.fields || {},
              voters,
              aiUsed: !!d.job.result?.aiUsed,
            });
            if (voters) {
              const sel = {};
              voters.forEach((_, i) => { sel[i] = true; });
              setListSelected((prev) => ({ ...sel, ...prev }));
            }
          } else if (st === 'error') {
            updateJob(targetJob.jobId, {
              status: 'error',
              error: d.job.error || 'Erro no processamento.',
            });
          } else {
            updateJob(targetJob.jobId, { status: 'queued' });
          }
        } catch {
          // falha de rede no poll: tenta de novo no próximo tick
        }
      }
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, activeJobId]);

  function handleApply() {
    if (!activeJob || activeJob.applied) return;
    if (!activeJob?.parsed && !activeJob?.voters) return;
    if (activeJob.voters) {
      const selected = activeJob.voters.filter((_, i) => listSelected[i] !== false);
      if (!selected.length) return;
      onResult({ type: 'lista', voters: selected });
    } else {
      onResult({
        nome: activeJob.parsed.nome || '',
        zona: activeJob.parsed.zona || '',
        secao: activeJob.parsed.secao || '',
        titleNumber: activeJob.parsed.titleNumber || '',
      });
    }
    appliedRef.current.add(activeJob.jobId);
    updateJob(activeJob.jobId, { applied: true });
    resetCurrent();
  }

  function toggleListSelect(i) {
    setListSelected((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function startEdit(i) {
    setEditingIdx(i);
    setEditDraft({ ...activeJob.voters[i] });
  }

  function updateDraft(field, value) {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  }

  function saveEdit() {
    if (!activeJob || editDraft == null || editingIdx == null) return;
    const next = activeJob.voters.map((v, i) => (i === editingIdx ? { ...v, ...editDraft } : v));
    updateJob(activeJob.jobId, { voters: next });
    setEditingIdx(null);
    setEditDraft(null);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditDraft(null);
  }

  function resetCurrent() {
    setActiveJobId(null);
    setError('');
    setListSelected({});
    setEditingIdx(null);
    setEditDraft(null);
  }

  function handleClose() {
    setJobs([]);
    setActiveJobId(null);
    setError('');
    setListSelected({});
    setEditingIdx(null);
    setEditDraft(null);
    appliedRef.current = new Set();
    onClose();
  }

  const appliedCount = jobs.filter((j) => j.applied).length;

  return (
    <BottomSheet open={open} onClose={handleClose} title="Título de Eleitor — OCR">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addFile(f);
          e.target.value = '';
        }}
      />

      {jobs.length > 0 && (
        <div className="ocr-queue">
          {jobs.map((job, idx) => (
            <button
              type="button"
              key={job.jobId}
              className={`ocr-queue-item${job.jobId === activeJobId ? ' active' : ''}`}
              onClick={() => setActiveJobId(job.jobId)}
            >
              <span className={`q-status q-status-${job.applied ? 'applied' : job.status}`}>
                <Icon name={job.applied ? 'check_circle' : (STATUS_ICONS[job.status] || 'help')} size={18} />
              </span>
              <div className="q-info">
                <div className="q-filename">
                  {jobs.length > 1 ? `${idx + 1}. ` : ''}{job.filename}
                </div>
                <div className="q-meta">
                  {(job.applied ? STATUS_LABELS.applied : STATUS_LABELS[job.status]) || job.status}
                  {job.status === 'done' && job.voters ? ` · ${job.voters.length} eleitor(es)` : ''}
                </div>
              </div>
              {!job.applied && ['uploading', 'queued', 'processing'].includes(job.status) && (
                <div className="ocr-progress" style={{ width: 40, height: 4 }}>
                  <div className="ocr-progress-fill" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Icon name="hourglass_top" size={32} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>
            {activeJob?.status === 'uploading' && 'Enviando foto...'}
            {activeJob?.status === 'queued' && 'Na fila de processamento...'}
            {activeJob?.status === 'processing' && 'Lendo o título...'}
          </div>
          <div className="meta" style={{ marginBottom: 12 }}>
            Pode levar até 1 minuto. Você pode enviar outra foto enquanto processa.
          </div>
          <div className="ocr-progress"><div className="ocr-progress-fill" /></div>
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: 16 }}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="add_a_photo" size={18} /> Enviar outra foto
          </button>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {activeJob?.status === 'done' && !activeJob.applied && activeJob.voters && (
        <div>
          {activeJob.image && (
            <img
              src={activeJob.image}
              alt="Caderneta capturada"
              style={{
                width: '100%', maxHeight: 220, objectFit: 'contain',
                background: 'var(--surface-high)',
                borderRadius: 8, marginBottom: 12,
              }}
            />
          )}
          <div className="alert success">
            {activeJob.voters.length} eleitor(es) lidos da caderneta{activeJob.aiUsed ? ' com ajuda da IA' : ''}. Confira antes de salvar.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {activeJob.voters.map((v, i) => (
              <div
                key={i}
                className="card"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: 10,
                  opacity: listSelected[i] === false ? 0.5 : 1,
                  borderColor: editingIdx === i ? 'var(--primary)' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  style={{ marginTop: 3 }}
                  checked={listSelected[i] !== false}
                  onChange={() => toggleListSelect(i)}
                />
                {editingIdx === i ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      ['nome', 'Nome'],
                      ['telefone', 'Telefone'],
                      ['titleNumber', 'Nº Título'],
                      ['secao', 'Seção'],
                      ['zona', 'Zona'],
                      ['bairro', 'Bairro'],
                    ].map(([field, label]) => (
                      <label key={field} style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>
                        {label}
                        <input
                          type="text"
                          value={editDraft?.[field] || ''}
                          onChange={(e) => updateDraft(field, e.target.value)}
                          style={{
                            width: '100%', marginTop: 2, padding: '6px 8px',
                            fontSize: '0.85rem', border: '1px solid var(--border)',
                            borderRadius: 6, background: 'var(--surface)',
                            color: 'var(--text)',
                          }}
                        />
                      </label>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button type="button" className="btn" style={{ width: 'auto', minHeight: 36, padding: '6px 14px', fontSize: '0.8rem' }} onClick={saveEdit}>
                        Salvar
                      </button>
                      <button type="button" className="btn secondary" style={{ width: 'auto', minHeight: 36, padding: '6px 14px', fontSize: '0.8rem' }} onClick={cancelEdit}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="meta" style={{ flex: 1, fontSize: '0.8rem' }}>
                      <strong>{i + 1}. {v.nome || '—'}</strong>{v.titleValid === false ? ' ⚠️' : ''}<br />
                      Tel: {v.telefone || '—'} · Título: {v.titleNumber || '—'}{v.titleValid === false ? ' (confira o nº)' : ''}<br />
                      Seção: {v.secao || '—'} · Zona: {v.zona || '—'}{v.bairro ? ` · ${v.bairro}` : ''}
                    </div>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ width: 'auto', minHeight: 36, padding: '6px 12px', fontSize: '0.75rem', flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'center' }}
                      onClick={() => startEdit(i)}
                      title="Editar dados lidos"
                    >
                      <Icon name="edit" size={16} /> Editar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="row-actions">
            <button className="btn" onClick={handleApply}>
              Cadastrar selecionados ({activeJob.voters.filter((_, i) => listSelected[i] !== false).length})
            </button>
            <button className="btn secondary" onClick={() => inputRef.current?.click()}>
              Outra foto
            </button>
            <button className="btn danger-outline" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {activeJob?.status === 'done' && !activeJob.applied && !activeJob.voters && (
        <div>
          {activeJob.image && (
            <img
              src={activeJob.image}
              alt="Título capturado"
              style={{
                width: '100%', maxHeight: 220, objectFit: 'contain',
                background: 'var(--surface-high)',
                borderRadius: 8, marginBottom: 12,
              }}
            />
          )}
          <div className="alert success">
            Dados extraídos{activeJob.aiUsed ? ' com ajuda da IA' : ''}. Confira antes de salvar.
          </div>
          <div className="card" style={{ padding: 10, marginBottom: 12 }}>
            <div className="meta" style={{ fontSize: '0.85rem' }}>
              <strong>Nome:</strong> {activeJob.parsed?.nome || '—'}<br />
              <strong>Zona:</strong> {activeJob.parsed?.zona || '—'}<br />
              <strong>Seção:</strong> {activeJob.parsed?.secao || '—'}<br />
              <strong>Nº Título:</strong> {activeJob.parsed?.titleNumber || '—'}
            </div>
          </div>
          <div className="row-actions">
            <button className="btn" onClick={handleApply}>
              Aplicar
            </button>
            <button className="btn secondary" onClick={() => inputRef.current?.click()}>
              Outra foto
            </button>
            <button className="btn danger-outline" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {activeJob?.status === 'done' && activeJob.applied && (
        <div>
          <div className="alert success">
            Cadastrado com sucesso{activeJob.voters ? ` (${activeJob.voters.length} eleitor(es))` : ''}. Confira na lista de eleitores.
          </div>
          <div className="row-actions">
            <button className="btn secondary" onClick={() => inputRef.current?.click()}>
              Outra foto
            </button>
            <button className="btn danger-outline" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {activeJob?.status === 'error' && (
        <div>
          <div className="alert error">{activeJob.error || 'Erro no processamento.'}</div>
          <div className="row-actions">
            <button className="btn secondary" onClick={() => inputRef.current?.click()}>
              Tentar com outra foto
            </button>
            <button className="btn danger-outline" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {!activeJob && !busy && jobs.length > 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div className="meta" style={{ marginBottom: 12 }}>
            {appliedCount} de {jobs.length} foto(s) cadastrada(s). Toque em um item acima para confirmar.
          </div>
          <button type="button" className="btn secondary" onClick={() => inputRef.current?.click()}>
            <Icon name="add_a_photo" size={18} /> Enviar mais fotos
          </button>
        </div>
      )}

      {!activeJob && !busy && jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Icon name="add_a_photo" size={32} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Envie uma foto do título</div>
          <div className="meta" style={{ marginBottom: 12 }}>
            Você pode enviar várias fotos de uma vez.
          </div>
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            Escolher foto
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
