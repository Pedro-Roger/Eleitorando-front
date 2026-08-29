import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, apiDownload, getUser } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

// Colunas disponíveis — precisa espelhar COLUMNS da rota /export da API
const COLUMN_OPTIONS = [
  { key: 'phone', label: 'Telefone' },
  { key: 'city', label: 'Cidade' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'state', label: 'Estado' },
  { key: 'gender', label: 'Gênero' },
  { key: 'age', label: 'Idade' },
  { key: 'zone', label: 'Zona' },
  { key: 'section', label: 'Seção' },
  { key: 'titleNumber', label: 'Nº Título' },
  { key: 'createdBy', label: 'Cadastrado por' },
  { key: 'cabo', label: 'Cabo responsável' },
];

const FORMATS = [
  { key: 'xlsx', label: 'Excel (XLS)', icon: 'table_view' },
  { key: 'csv', label: 'CSV', icon: 'csv' },
  { key: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
  { key: 'wpp', label: 'WhatsApp', icon: 'chat' },
];

export default function Export() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';

  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');

  // Seleção de equipe: ids de cabos marcados e, por cabo, ids de subcabos marcados
  const [selCabos, setSelCabos] = useState([]);
  const [selSubs, setSelSubs] = useState({}); // { caboId: [subId, ...] }

  const [subcabo, setSubcabo] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [gender, setGender] = useState('');

  const [columns, setColumns] = useState(['phone', 'city', 'neighborhood']);
  const [total, setTotal] = useState(null);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    if (isAdmin) api('/export/options').then(setOptions).catch((e) => setError(e.message));
  }, [isAdmin]);

  // Subcabos disponíveis no filtro: todos, ou só os dos cabos marcados na árvore
  const subcaboOptions = useMemo(() => {
    if (!options) return [];
    const cabos = selCabos.length
      ? options.cabos.filter((c) => selCabos.includes(c.id))
      : options.cabos;
    return cabos.flatMap((c) => c.subcabos.map((s) => ({ ...s, caboName: c.name })));
  }, [options, selCabos]);

  // Expande a seleção da equipe para a lista final de "cadastrado por":
  // subcabo escolhido no filtro = só ele; senão: nada marcado = todos;
  // cabo marcado sem subcabos marcados = cabo + todos os subcabos dele;
  // cabo marcado com subcabos marcados = cabo + apenas os marcados.
  const createdByIds = useMemo(() => {
    if (subcabo && subcaboOptions.some((s) => s.id === Number(subcabo))) return [Number(subcabo)];
    if (!options || selCabos.length === 0) return [];
    const ids = [];
    for (const caboId of selCabos) {
      const cabo = options.cabos.find((c) => c.id === caboId);
      if (!cabo) continue;
      ids.push(cabo.id);
      const chosen = selSubs[caboId] || [];
      if (chosen.length === 0) ids.push(...cabo.subcabos.map((s) => s.id));
      else ids.push(...chosen);
    }
    return ids;
  }, [options, selCabos, selSubs, subcabo, subcaboOptions]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (createdByIds.length) p.set('createdByIds', createdByIds.join(','));
    if (city) p.set('city', city);
    if (neighborhood) p.set('neighborhood', neighborhood);
    if (gender) p.set('gender', gender);
    return p;
  }, [createdByIds, city, neighborhood, gender]);

  // Prévia da contagem, atualizada a cada mudança de filtro
  useEffect(() => {
    if (!isAdmin) return;
    const p = new URLSearchParams(query);
    p.set('count', '1');
    let alive = true;
    api(`/export/voters?${p}`).then((d) => alive && setTotal(d.total)).catch(() => {});
    return () => { alive = false; };
  }, [isAdmin, query]);

  if (!isAdmin) return <Navigate to="/" replace />;

  function toggleCabo(id) {
    setSelCabos((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }
  function toggleSub(caboId, subId) {
    setSelSubs((prev) => {
      const cur = prev[caboId] || [];
      const next = cur.includes(subId) ? cur.filter((s) => s !== subId) : [...cur, subId];
      return { ...prev, [caboId]: next };
    });
  }
  function toggleColumn(key) {
    setColumns((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  async function download(format) {
    setDownloading(format);
    setError('');
    try {
      const p = new URLSearchParams(query);
      p.set('format', format);
      p.set('columns', columns.join(','));
      await apiDownload(`/export/voters?${p}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading('');
    }
  }

  return (
    <>
      <AppHeader title="Exportar dados" subtitle="Compartilhamento de eleitores" back />
      <div className="page" style={{ paddingBottom: 104 }}>
        {error && <div className="alert error">{error}</div>}
        {!options && !error && <div className="empty">Carregando...</div>}

        {options && (
          <>
            <div className="section-title">Equipe</div>
            <div className="card">
              <div className="meta" style={{ marginBottom: 8 }}>
                Nada marcado = eleitores de toda a equipe. Marque um cabo para exportar só os dele
                (e escolha subcabos específicos, se quiser).
              </div>
              {options.cabos.length === 0 && <div className="meta">Nenhum cabo cadastrado.</div>}
              {options.cabos.map((c) => (
                <div key={c.id} style={{ marginBottom: 4 }}>
                  <label className="check-row">
                    <input type="checkbox" checked={selCabos.includes(c.id)} onChange={() => toggleCabo(c.id)} />
                    <span>{c.name}</span>
                  </label>
                  {selCabos.includes(c.id) && c.subcabos.length > 0 && (
                    <div style={{ paddingLeft: 28 }}>
                      {c.subcabos.map((s) => (
                        <label key={s.id} className="check-row">
                          <input
                            type="checkbox"
                            checked={(selSubs[c.id] || []).includes(s.id)}
                            onChange={() => toggleSub(c.id, s.id)}
                          />
                          <span className="meta">{s.name}</span>
                        </label>
                      ))}
                      <div className="hint">Nenhum subcabo marcado = todos os subcabos deste cabo.</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="section-title">Filtros</div>
            <div className="card">
              {subcaboOptions.length > 0 && (
                <div className="field">
                  <label>Subcabo</label>
                  <select value={subcabo} onChange={(e) => setSubcabo(e.target.value)}>
                    <option value="">Todos</option>
                    {subcaboOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.caboName}</option>
                    ))}
                  </select>
                  <div className="hint">Escolhendo um subcabo, saem apenas os eleitores cadastrados por ele.</div>
                </div>
              )}
              <div className="field">
                <label>Cidade</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Todas</option>
                  {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Bairro</label>
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
                  <option value="">Todos</option>
                  {options.neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Gênero</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Todos</option>
                  {options.genders.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="section-title">Colunas</div>
            <div className="card">
              <label className="check-row">
                <input type="checkbox" checked disabled />
                <span>Nome (sempre incluído)</span>
              </label>
              {COLUMN_OPTIONS.map((c) => (
                <label key={c.key} className="check-row">
                  <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                  <span>{c.label}</span>
                </label>
              ))}
              <div className="hint">
                A lista para WhatsApp usa sempre Nome + Telefone, no formato aceito por listas de transmissão.
              </div>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-title" style={{ fontSize: 22 }}>
                {total == null ? '—' : total}
              </div>
              <div className="meta">eleitor{total === 1 ? '' : 'es'} ser{total === 1 ? 'á' : 'ão'} exportado{total === 1 ? '' : 's'}</div>
            </div>

            <div className="section-title">Compartilhar como</div>
            <div className="quick-actions">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  className="btn secondary"
                  disabled={!!downloading || total === 0}
                  onClick={() => download(f.key)}
                >
                  <Icon name={f.icon} size={20} />
                  {downloading === f.key ? 'Gerando...' : f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
