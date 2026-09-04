import { useEffect, useRef, useState } from 'react';
import StateCitySelect from './StateCitySelect';
import Icon from './Icon';
import OcrCapture from './OcrCapture';
import { api } from '../lib/api';
import { parseVoterText } from '../lib/voterTextParser';

const GENDERS = ['Feminino', 'Masculino', 'Outro', 'Prefere não informar'];

// Formulário de cadastro/edição de eleitor — reutilizado tanto no "Novo Eleitor"
// quanto na edição de um eleitor já existente (initial preenchido).
export default function VoterForm({ initial, onSubmit, onDraftsSaved, submitting, error, submitLabel = 'Salvar Cadastro' }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    phone: initial?.phone || '',
    state: initial?.state || 'CE',
    city: initial?.city || '',
    neighborhood: initial?.neighborhood || '',
    gender: initial?.gender || '',
    age: initial?.age ?? '',
    zone: initial?.zone || '',
    section: initial?.section || '',
    titleNumber: initial?.titleNumber || '',
    notes: initial?.notes || '',
  });
  const [zoneSecaoStatus, setZoneSecaoStatus] = useState('');
  const [reverseMatches, setReverseMatches] = useState([]);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [textImport, setTextImport] = useState('');
  const [textImportStatus, setTextImportStatus] = useState('');
  // Rascunhos reconhecidos da colagem (múltiplos eleitores): ficam visíveis pra
  // revisar/editar antes de salvar, em vez de salvar direto.
  const [drafts, setDrafts] = useState([]);
  const [editingDraft, setEditingDraft] = useState(null);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const ocrFileInputRef = useRef(null);
  const autoFilledRef = useRef({ city: false, neighborhood: false });

  // Quando zona + seção são preenchidas (Ceará), busca cidade/bairro na tabela do
  // TRE-CE e preenche automaticamente — só sobrescreve campos que o usuário não
  // digitou manualmente (ou que já vieram do próprio autofill numa consulta anterior).
  useEffect(() => {
    const zone = form.zone.replace(/\D/g, '');
    const section = form.section.replace(/\D/g, '');
    if (form.state !== 'CE' || !zone || !section) {
      setZoneSecaoStatus('');
      return;
    }
    const timer = setTimeout(() => {
      api(`/voters/lookup-zona-secao?zone=${zone}&section=${section}`)
        .then(({ match }) => {
          if (!match) {
            setZoneSecaoStatus('not-found');
            return;
          }
          setZoneSecaoStatus('found');
          setForm((f) => {
            const next = { ...f };
            if (match.city && (!f.city || autoFilledRef.current.city)) {
              next.city = match.city;
              autoFilledRef.current.city = true;
            }
            if (match.neighborhood && (!f.neighborhood || autoFilledRef.current.neighborhood)) {
              next.neighborhood = match.neighborhood;
              autoFilledRef.current.neighborhood = true;
            }
            return next;
          });
        })
        .catch(() => setZoneSecaoStatus(''));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.zone, form.section, form.state]);

  // Sentido inverso: se zona/seção ainda não foram preenchidas, cidade+bairro tentam
  // achar a(s) seção(ões) correspondentes. Um bairro pode cair em várias seções —
  // se achar só uma, preenche direto; se achar mais, mostra uma lista pra escolher.
  useEffect(() => {
    const zone = form.zone.replace(/\D/g, '');
    const section = form.section.replace(/\D/g, '');
    if (form.state !== 'CE' || zone || section || !form.city.trim() || !form.neighborhood.trim()) {
      setReverseMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      api(`/voters/lookup-city-bairro?city=${encodeURIComponent(form.city)}&neighborhood=${encodeURIComponent(form.neighborhood)}`)
        .then(({ matches }) => {
          if (!matches || !matches.length) {
            setReverseMatches([]);
            return;
          }
          if (matches.length === 1) {
            setForm((f) => ({ ...f, zone: String(matches[0].zone), section: String(matches[0].section) }));
            setReverseMatches([]);
            return;
          }
          setReverseMatches(matches);
        })
        .catch(() => setReverseMatches([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [form.city, form.neighborhood, form.state, form.zone, form.section]);

  function pickReverseMatch(m) {
    setForm((f) => ({ ...f, zone: String(m.zone), section: String(m.section) }));
    setReverseMatches([]);
  }

  function applyTextImport(text = textImport) {
    const parsedList = parseVoterText(text);
    if (!parsedList || !parsedList.length) {
      setTextImportStatus('Nenhum campo reconhecido.');
      return;
    }

    if (parsedList.length === 1) {
      const parsed = parsedList[0];
      setForm((f) => ({ ...f, ...parsed }));
      autoFilledRef.current.city = false;
      autoFilledRef.current.neighborhood = false;
      setTextImportStatus(`${Object.keys(parsed).length} campo(s) preenchido(s).`);
    } else {
      setDrafts(parsedList);
      setEditingDraft(null);
      setTextImportStatus(`${parsedList.length} eleitores reconhecidos — clique em um para revisar e editar.`);
    }
  }

  function cleanDraft(d) {
    const out = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (!k.startsWith('_')) out[k] = v;
    }
    return out;
  }

  function draftSummary(d) {
    const parts = [];
    if (d.phone) parts.push(d.phone);
    if (d.titleNumber) parts.push(`Título ${d.titleNumber}`);
    const zs = [d.zone ? `Z${d.zone}` : '', d.section ? `S${d.section}` : ''].filter(Boolean).join(' ');
    if (zs) parts.push(zs);
    return parts.join(' · ');
  }

  function toVoterPayload(d) {
    return {
      name: d.name || '',
      phone: d.phone || '',
      state: 'CE',
      city: d.city || '',
      neighborhood: d.neighborhood || '',
      gender: d.gender || '',
      age: d.age ?? '',
      zone: d.zone || '',
      section: d.section || '',
      titleNumber: d.titleNumber || '',
      notes: d.notes || '',
    };
  }

  function editDraft(i) {
    const d = drafts[i];
    if (!d) return;
    setForm((f) => ({ ...f, ...cleanDraft(d) }));
    autoFilledRef.current.city = false;
    autoFilledRef.current.neighborhood = false;
    setEditingDraft(i);
    setTextImportStatus(`Editando rascunho ${i + 1} no formulário abaixo.`);
  }

  function removeDraft(i) {
    setDrafts((ds) => ds.filter((_, idx) => idx !== i));
    setEditingDraft((cur) => {
      if (cur === null) return null;
      if (cur === i) return null;
      return cur > i ? cur - 1 : cur;
    });
  }

  async function saveSingleDraft(i, values) {
    setSavingDrafts(true);
    try {
      await api('/voters', { method: 'POST', body: toVoterPayload(values) });
      setDrafts((ds) => ds.filter((_, idx) => idx !== i));
      setEditingDraft(null);
      setTextImportStatus('Rascunho salvo.');
      onDraftsSaved?.(1);
    } catch (err) {
      setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, _error: err.message || 'Falha ao salvar.' } : d)));
    } finally {
      setSavingDrafts(false);
    }
  }

  async function saveAllDrafts() {
    if (!drafts.length) return;
    const merged = drafts.map((d, i) => (i === editingDraft ? { ...cleanDraft(d), ...form } : d));
    setSavingDrafts(true);
    try {
      const res = await api('/voters/bulk', { method: 'POST', body: { voters: merged.map(toVoterPayload) } });
      const remaining = (res.failed || []).map((f) => ({ ...merged[f.index], _error: f.error || 'Falha ao salvar.' }));
      const saved = res.summary?.success ?? 0;
      setDrafts(remaining);
      setEditingDraft(null);
      if (saved > 0) onDraftsSaved?.(saved);
      setTextImportStatus(
        remaining.length
          ? `${saved} salvo(s), ${remaining.length} com erro — revise abaixo.`
          : `${saved} eleitor(es) salvos.`
      );
    } catch (err) {
      setTextImportStatus(`Falha ao salvar: ${err.message || err}`);
    } finally {
      setSavingDrafts(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Editando um rascunho: salva só ele e continua na lista
        if (editingDraft !== null) {
          saveSingleDraft(editingDraft, form);
        } else {
          onSubmit(form);
        }
      }}
    >
      {error && <div className="alert error">{error}</div>}

      <div className="row-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setTextImportOpen((open) => !open);
            setTextImportStatus('');
          }}
        >
          <Icon name="content_paste" size={16} /> Colar texto
        </button>
      </div>

      {textImportOpen && (
        <div className="field">
          <label>Texto do eleitor</label>
          <textarea
            rows={7}
            value={textImport}
            onChange={(e) => {
              setTextImport(e.target.value);
              setTextImportStatus('');
            }}
            onPaste={(e) => {
              // Reconhece na hora: deixa o navegador colar e processa o valor final
              const el = e.currentTarget;
              setTimeout(() => {
                setTextImport(el.value);
                applyTextImport(el.value);
              }, 0);
            }}
            placeholder={'nome completo: Nayele Rabelo Paulino\nCelular: 85921723287\nIdade: 21\nGênero: feminino\nCidade: Fortaleza\nBairro: Maraponga\nZona eleitoral: 118\nSeção: 0116'}
          />
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={applyTextImport}>
              <Icon name="auto_fix_high" size={16} /> Preencher
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setTextImport('');
                setTextImportStatus('');
              }}
            >
              <Icon name="close" size={16} /> Limpar
            </button>
          </div>
          {textImportStatus && <div className="hint">{textImportStatus}</div>}
          {drafts.length > 0 && (
            <div className="field">
              <label>Rascunhos reconhecidos ({drafts.length})</label>
              {drafts.map((d, i) => (
                <div key={i} className={`card${editingDraft === i ? '' : ' tappable'}`} style={{ marginBottom: 8 }}>
                  <div className="card-row">
                    <button type="button" className="card-button" onClick={() => editDraft(i)}>
                      <div className="card-copy">
                        <div className="card-title">{d.name || 'Sem nome'}</div>
                        {draftSummary(d) && <div className="meta">{draftSummary(d)}</div>}
                        {d._error && <div className="meta" style={{ color: 'var(--error, #B3261E)' }}>{d._error}</div>}
                      </div>
                    </button>
                    <button type="button" className="btn secondary" onClick={() => removeDraft(i)} title="Descartar rascunho">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="row-actions">
                <button type="button" className="btn" disabled={savingDrafts} onClick={saveAllDrafts}>
                  <Icon name="save" size={18} />
                  {savingDrafts ? 'Salvando...' : `Salvar todos (${drafts.length})`}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setDrafts([]);
                    setEditingDraft(null);
                  }}
                >
                  Descartar tudo
                </button>
              </div>
              {editingDraft !== null && (
                <div className="hint">Rascunho {editingDraft + 1} carregado no formulário — "Salvar Cadastro" salva só ele.</div>
              )}
            </div>
          )}
        </div>
      )}

      <h3 className="form-section-title">Dados Pessoais</h3>
      <div className="field">
        <label>Nome completo</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Maria da Silva" />
      </div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Zona eleitoral</label>
          <input
            inputMode="numeric"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            placeholder="Ex.: 012"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Seção</label>
          <input
            inputMode="numeric"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            placeholder="Ex.: 0345"
          />
        </div>
      </div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Nº Título</label>
          <input
            value={form.titleNumber}
            onChange={(e) => setForm({ ...form, titleNumber: e.target.value })}
            placeholder="Opcional"
          />
        </div>
        <div className="field" style={{ flex: 1, alignSelf: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={() => ocrFileInputRef.current?.click()}>
            <Icon name="camera_alt" size={16} /> OCR Título
          </button>
        </div>
      </div>
      {zoneSecaoStatus === 'found' && (
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          <Icon name="check_circle" size={14} /> Cidade e bairro preenchidos a partir da zona/seção.
        </div>
      )}
      {zoneSecaoStatus === 'not-found' && (
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          <Icon name="info" size={14} /> Zona/seção não encontrada — preencha cidade e bairro manualmente.
        </div>
      )}
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Celular</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Idade</label>
          <input
            type="number"
            min="16"
            max="120"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder="Ex.: 34"
          />
        </div>
      </div>
      <div className="field">
        <label>Gênero</label>
        <div className="pill-select">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              className={`pill-option ${form.gender === g ? 'active' : ''}`}
              onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <h3 className="form-section-title">Localização e Eleitoral</h3>
      <StateCitySelect
        state={form.state}
        city={form.city}
        hideState
        cityRequired={false}
        onChange={({ state, city }) => {
          autoFilledRef.current.city = false;
          setForm({ ...form, state, city });
        }}
      />
      <div className="field">
        <label>Bairro</label>
        <input
          value={form.neighborhood}
          onChange={(e) => {
            autoFilledRef.current.neighborhood = false;
            setForm({ ...form, neighborhood: e.target.value });
          }}
          placeholder="Bairro do eleitor"
        />
      </div>
      {reverseMatches.length > 0 && (
        <div className="field">
          <label>Encontramos {reverseMatches.length} seções nesse bairro — selecione a do eleitor</label>
          <div className="pill-select">
            {reverseMatches.map((m) => (
              <button
                key={`${m.zone}-${m.section}`}
                type="button"
                className="pill-option"
                onClick={() => pickReverseMatch(m)}
              >
                Zona {m.zone}, Seção {m.section}{m.local ? ` — ${m.local}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <h3 className="form-section-title">Detalhes Adicionais</h3>
      <div className="field">
        <label>Observações</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Opcional"
        />
      </div>

      {/* input escondido: clique no botão abre o picker direto (fila no servidor) */}
      <input
        ref={ocrFileInputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setOcrFile(file);
            setOcrOpen(true);
          }
          e.target.value = '';
        }}
      />

      <OcrCapture
        open={ocrOpen}
        onClose={() => { setOcrOpen(false); setOcrFile(null); }}
        onResult={(fields) => {
          setForm((f) => ({
            ...f,
            name: fields.nome || f.name,
            zone: fields.zona || f.zone,
            section: fields.secao || f.section,
            titleNumber: fields.titleNumber || f.titleNumber,
          }));
        }}
        file={ocrFile}
      />

      <button className="btn" disabled={submitting || savingDrafts}>
        <Icon name="save" size={18} />
        {submitting || savingDrafts ? 'Salvando...' : editingDraft !== null ? 'Salvar rascunho' : submitLabel}
      </button>
    </form>
  );
}
