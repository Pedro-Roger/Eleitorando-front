import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, getUser } from '../lib/api';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import OcrCapture from '../components/OcrCapture';
import VoterForm from '../components/VoterForm';
import StateCitySelect from '../components/StateCitySelect';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { avatarColor } from '../lib/avatar';

function locationLine(v) {
  return v.neighborhood || v.city || 'Sem localização';
}

export default function Voters() {
  const me = getUser();
  const [urlParams, setUrlParams] = useSearchParams();
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
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrFile, setOcrFile] = useState(null);
  const fileInputRef = useRef(null);

  // Filtros iniciais vindos da URL (cards do Início): ?hoje=1 e ?membro=me
  const [onlyToday, setOnlyToday] = useState(urlParams.get('hoje') === '1');

  // Filtro por localização: cidade (valor "UF|Cidade") e bairro
  const [cityFilter, setCityFilter] = useState('');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [cityOptions, setCityOptions] = useState([]);

  // Filtro por equipe: admin filtra por cabo e subcabo; cabo filtra pelos próprios subcabos
  const [caboFilter, setCaboFilter] = useState('');
  const [subFilter, setSubFilter] = useState(
    me?.role === 'CABO' && urlParams.get('membro') === 'me' ? 'me' : '',
  );
  const [cabosTree, setCabosTree] = useState([]); // admin: cabos com subcabos
  const [mySubs, setMySubs] = useState([]); // cabo: seus subcabos

  useEffect(() => {
    if (me?.role === 'ADMIN') api('/export/options').then((d) => setCabosTree(d.cabos)).catch(() => {});
    else if (me?.role === 'CABO') api('/users').then((d) => setMySubs(d.users)).catch(() => {});
    api('/voters/filter-options').then((d) => setCityOptions(d.cities)).catch(() => {});
  }, []);

  // Bairros exibidos: da cidade escolhida, ou de todas as cidades
  const neighborhoodOptions = useMemo(() => {
    const cities = cityFilter
      ? cityOptions.filter((c) => `${c.state}|${c.city}` === cityFilter)
      : cityOptions;
    return [...new Set(cities.flatMap((c) => c.neighborhoods))].sort((a, b) => a.localeCompare(b));
  }, [cityOptions, cityFilter]);

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
      if (onlyToday) p.set('today', '1');
      if (cityFilter) {
        const [state, city] = cityFilter.split('|');
        p.set('state', state);
        p.set('city', city);
      }
      if (neighborhoodFilter) p.set('neighborhood', neighborhoodFilter);
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
  }, [search, teamIds, onlyToday, cityFilter, neighborhoodFilter]);

  function clearTodayFilter() {
    setOnlyToday(false);
    urlParams.delete('hoje');
    setUrlParams(urlParams, { replace: true });
  }

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
      if (err.status === 409 && String(err.message).includes('título')) setFormError(err.message);
      else if (err.status === 409) setDupPhone(true);
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
      if (err.status === 409 && String(err.message).includes('título')) setEditError(err.message);
      else if (err.status === 409) setDupPhone(true);
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

        {onlyToday && (
          <div className="chip-row" style={{ marginBottom: 12 }}>
            <button type="button" className="chip primary" onClick={clearTodayFilter} aria-label="Remover filtro de cadastros de hoje">
              <Icon name="today" size={12} />
              Cadastrados hoje
              <Icon name="close" size={12} />
            </button>
          </div>
        )}

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

        {cityOptions.length > 0 && (
          <div className="row-actions" style={{ marginTop: 0, marginBottom: 4 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Cidade</label>
              <select
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setNeighborhoodFilter(''); }}
              >
                <option value="">Todas</option>
                {cityOptions.map((c) => (
                  <option key={`${c.state}|${c.city}`} value={`${c.state}|${c.city}`}>{c.city}/{c.state}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Bairro</label>
              <select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}>
                <option value="">Todos</option>
                {neighborhoodOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
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
              {v.titleNumber && <span className="chip"><Icon name="badge" size={12} />{v.titleNumber}</span>}
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
        onClick={() => { setFormError(''); setOcrResult(null); setOpen(true); }}
        aria-label="Cadastrar eleitor"
      >
        <Icon name="add" size={28} />
      </button>

      <button
        className="btn fab"
        onClick={() => { setOcrResult(null); setOcrOpen(true); }}
        aria-label="OCR do título de eleitor"
        style={{ right: '80px' }}
      >
        <Icon name="camera_alt" size={28} />
      </button>

      <button
        className="btn fab"
        onClick={() => { setFormError(''); setOcrResult(null); setOpen(true); }}
        aria-label="Cadastrar eleitor"
      >
        <Icon name="add" size={28} />
      </button>

      <button
        type="button"
        className="btn fab"
        onClick={() => fileInputRef.current?.click()}
        aria-label="OCR do título de eleitor"
        style={{ right: '80px' }}
      >
        <Icon name="camera_alt" size={28} />
      </button>

      {/* input em nível de página: clique no FAB abre o picker direto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
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
        onClose={() => setOcrOpen(false)}
        onResult={async (fields) => {
          if (fields.type === 'lista') {
            let ok = 0;
            let fail = 0;
            for (const v of fields.voters) {
              try {
                await api('/voters', {
                  method: 'POST',
                  body: {
                    name: v.nome || '',
                    phone: v.telefone || '',
                    state: 'CE',
                    city: '',
                    neighborhood: v.bairro || '',
                    gender: v.gender || '',
                    age: '',
                    zone: v.zona || '',
                    section: v.secao || '',
                    titleNumber: v.titleNumber || '',
                    notes: '',
                  },
                });
                ok += 1;
              } catch {
                fail += 1;
              }
            }
            flash(`Lista salva: ${ok} cadastrado(s)${fail ? `, ${fail} falha(s)` : ''}`);
            load(search);
            return;
          }
          try {
            await api('/voters', {
              method: 'POST',
              body: {
                name: fields.nome || '',
                phone: '',
                state: 'CE',
                city: '',
                neighborhood: '',
                gender: fields.gender || '',
                age: fields.age || '',
                zone: fields.zona || '',
                section: fields.secao || '',
                titleNumber: fields.titleNumber || '',
                notes: '',
              },
            });
            flash('Eleitor cadastrado via OCR.');
            load(search);
          } catch (e) {
            flash(`Falha ao cadastrar: ${e.message}`);
          }
        }}
        file={ocrFile}
      />

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Novo Eleitor">
        <VoterForm
          initial={ocrResult ? { name: ocrResult.nome, gender: ocrResult.gender, age: ocrResult.age, zone: ocrResult.zona, section: ocrResult.secao, titleNumber: ocrResult.titleNumber } : undefined}
          onSubmit={handleCreate}
          submitting={saving}
          error={formError}
          submitLabel="Salvar Cadastro"
        />
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
