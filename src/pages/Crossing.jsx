import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, apiDownload, getUser } from '../lib/api';
import './Crossing.css';

const count = (value) => Number(value || 0).toLocaleString('pt-BR');
const percent = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function ReportFilters({ cabos, subcabos, filters, update, clear }) {
  const visibleSubcabos = filters.caboId
    ? subcabos.filter((subcabo) => String(subcabo.caboId) === filters.caboId)
    : subcabos;
  return (
    <div className="election-filters">
      <label>Cabo
        <select aria-label="Cabo" value={filters.caboId} onChange={(event) => update('caboId', event.target.value)}>
          <option value="">Todos</option>
          {cabos.map((cabo) => <option key={cabo.id} value={cabo.id}>{cabo.title}</option>)}
        </select>
      </label>
      <label>Subcabo
        <select aria-label="Subcabo" value={filters.subcaboId} onChange={(event) => update('subcaboId', event.target.value)}>
          <option value="">Todos</option>
          {visibleSubcabos.map((subcabo) => <option key={subcabo.id} value={subcabo.id}>{subcabo.title}</option>)}
        </select>
      </label>
      {[
        ['city', 'Cidade', 'Fortaleza'], ['neighborhood', 'Bairro', 'Centro'],
        ['zone', 'Zona', '120'], ['section', 'Seção', '0533'],
      ].map(([key, label, placeholder]) => (
        <label key={key}>{label}
          <input aria-label={label} value={filters[key]} onChange={(event) => update(key, event.target.value)}
            placeholder={placeholder} inputMode={key === 'zone' || key === 'section' ? 'numeric' : 'text'} />
        </label>
      ))}
      <button className="election-clear" type="button" onClick={clear}>Limpar filtros</button>
    </div>
  );
}

export default function Crossing() {
  const [candidates, setCandidates] = useState([]);
  const [candidateName, setCandidateName] = useState('');
  const [cabos, setCabos] = useState([]);
  const [subcabos, setSubcabos] = useState([]);
  const [filters, setFilters] = useState({ caboId: '', subcaboId: '', city: '', neighborhood: '', zone: '', section: '' });
  const [report, setReport] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = getUser()?.role === 'ADMIN';

  useEffect(() => {
    api('/candidates').then((data) => setCandidates(data.candidates || [])).catch(() => setCandidates([]));
    if (isAdmin) {
      api('/dashboard/list?type=cabos').then((data) => setCabos(data.items || [])).catch(() => setCabos([]));
      api('/dashboard/list?type=subcabos').then((data) => setSubcabos(data.items || [])).catch(() => setSubcabos([]));
    }
  }, [isAdmin]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ candidateName });
    for (const [name, value] of Object.entries(filters)) {
      if (String(value).trim()) params.set(name, String(value).trim());
    }
    return `?${params.toString()}`;
  }, [candidateName, filters]);

  useEffect(() => {
    if (!candidateName) { setReport(null); return; }
    let active = true;
    setLoading(true);
    setError('');
    api(`/elections/inteligencia-eleitoral${query}`)
      .then((data) => { if (active) setReport(data); })
      .catch((e) => { if (active) { setReport(null); setError(e.message || 'Não foi possível carregar os relatórios.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [candidateName, query]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current, [name]: value,
      ...(name === 'caboId' ? { subcaboId: '' } : {}),
    }));
  }

  async function download(path) {
    try { await apiDownload(`/elections/inteligencia-eleitoral/${path}/pdf${query}`); }
    catch (e) { setError(e.message || 'Não foi possível gerar o PDF.'); }
  }

  const missing = report?.missingSections || [];
  const ranking = report?.cabos || [];
  const activeFilterCount = Object.values(filters).filter((value) => String(value).trim()).length;
  return (
    <>
      <AppHeader title="Inteligência Eleitoral" subtitle="Dois relatórios por cabo" />
      <div className="page comparison-page election-reports">
        <h2>Relatórios eleitorais</h2>
        <p className="election-intro">Promessas e resultados organizados por cabo e seus subcabos.</p>
        <div className="election-candidates">
          {candidates.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => setCandidateName(candidate.name)}
              className={candidateName === candidate.name ? 'selected' : ''}>
              {candidate.name}
            </button>
          ))}
        </div>
        {!candidateName ? <div className="empty">Selecione uma candidata para ver os relatórios.</div> : (
          <>
            <button className="election-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="election-filters"
              onClick={() => setFiltersOpen((open) => !open)}>
              {filtersOpen ? 'Ocultar filtros' : `Mostrar filtros${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
            </button>
            <div id="election-filters" className={filtersOpen ? 'election-filter-panel open' : 'election-filter-panel'}>
              <ReportFilters cabos={cabos} subcabos={subcabos} filters={filters} update={updateFilter}
                clear={() => setFilters({ caboId: '', subcaboId: '', city: '', neighborhood: '', zone: '', section: '' })} />
            </div>
            {error && <div className="alert error">{error}</div>}
            {loading ? <div className="empty">Carregando relatórios...</div> : report && (
              <div className="election-report-stack">
                <section className="election-report" aria-labelledby="missing-title">
                  <div className="election-report-heading">
                    <div>
                      <h3 id="missing-title">Possíveis pessoas não votantes</h3>
                      <p>Promessas acima dos votos oficiais da seção.</p>
                    </div>
                    <button className="election-download" type="button" onClick={() => download('eleitores')}>Baixar PDF de possíveis não votantes</button>
                  </div>
                  <p className="election-explanation">Os nomes apontam possibilidades para acompanhamento; não confirmam o voto individual.</p>
                  {!missing.length ? <div className="empty">Nenhuma seção com diferença numérica para os filtros.</div> : missing.map((section) => (
                    <article key={`${section.caboId}-${section.city}-${section.zona}-${section.secao}`} className="election-section">
                      <div className="election-section-heading">
                        <h4>Cabo: {section.cabo}</h4>
                        <p>{section.city} · Zona {section.zona} · Seção {section.secao}</p>
                      </div>
                      <div className="election-metrics">
                        <div><strong>{count(section.prometidos)}</strong><span>Prometeram</span></div>
                        <div><strong>{count(section.apuradoTseNaSecao)}</strong><span>Resultado na seção</span></div>
                        <div><strong>{count(section.possivelmenteVotaram)}</strong><span>Possivelmente votaram</span></div>
                        <div className="election-metric-missing"><strong>{count(section.faltantes)}</strong><span>Possíveis faltantes · {percent(section.percentualFaltantes)}</span></div>
                      </div>
                      <h5>Pessoas cadastradas nesta seção</h5>
                      {section.pessoas.map((person, index) => (
                        <div key={`${person.name}-${index}`} className="election-person">
                          <strong>{person.name}</strong>
                          <span>{person.subcabo ? `Subcabo: ${person.subcabo}` : 'Cadastro direto'} · {person.city} · {person.bairro} · Zona {person.zona} · Seção {person.secao}</span>
                        </div>
                      ))}
                    </article>
                  ))}
                </section>
                <section className="election-report" aria-labelledby="summary-title">
                  <div className="election-report-heading">
                    <h3 id="summary-title">Resumo por cabo e subcabo</h3>
                    <button className="election-download secondary" type="button" onClick={() => download('resumo-cabos')}>Baixar PDF do resumo</button>
                  </div>
                  {!ranking.length ? <div className="empty">Nenhum cadastro para os filtros.</div> : ranking.map((cabo) => (
                    <div key={cabo.id} className="election-summary-cabo">
                      <h4>Cabo: {cabo.name} <span>{count(cabo.prometidos)} promessas</span></h4>
                      <p>{count(cabo.secoes)} seções · {count(cabo.secoesComFaltantes)} com diferença numérica</p>
                      {cabo.cidades.map((city) => (
                        <div key={city.name} className="election-summary-city">
                          <h5>Cidade: {city.name} <span>{count(city.prometidos)} promessas</span></h5>
                          {city.subcabos.map((subcabo) => (
                            <div key={subcabo.id} className="election-summary-subcabo">
                              <strong>Subcabo: {subcabo.name} <span>{count(subcabo.prometidos)} promessas</span></strong>
                              {subcabo.zonas.map((zone) => (
                                <div key={zone.name} className="election-summary-zone">
                                  <b>Zona {zone.name}</b> <span>{count(zone.prometidos)} promessas</span>
                                  {zone.secoes.map((section) => (
                                    <div key={section.name} className="election-summary-section">Seção {section.name} <span>{count(section.prometidos)} promessas</span></div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
