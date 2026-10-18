import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, apiDownload, getUser } from '../lib/api';
import './Crossing.css';

const count = (value) => Number(value || 0).toLocaleString('pt-BR');
const percent = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const formatCoverage = (value) => {
  const num = Number(value || 0);
  return percent(num <= 1 ? num * 100 : num);
};

const norm = (value) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
const padNum = (value, width) => {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? String(n).padStart(width, '0') : String(value ?? '').trim();
};
const locKey = (city, zone, section) => `${norm(city)}|${padNum(zone, 2)}|${padNum(section, 4)}`;

function combineMetrics(items) {
  if (!items || !items.length) {
    return { mode: 'default', prometidos: 0, entregue: 0, faltante: 0, cobertura: 0 };
  }
  if (items.length === 1) {
    const item = items[0];
    const prometidos = Number(item.prometidos) || 0;
    const entregue = Number(item.entregue ?? item.votos ?? item.possivelmenteVotaram) || 0;
    const faltante = Number(item.faltante ?? item.faltantes) || 0;
    const cobertura = item.cobertura !== undefined
      ? Number(item.cobertura) || 0
      : (prometidos > 0 ? entregue / prometidos : 0);
    return { mode: 'default', prometidos, entregue, faltante, cobertura };
  }
  let prometidos = 0;
  let entregue = 0;
  let faltante = 0;
  for (const item of items) {
    prometidos += Number(item.prometidos) || 0;
    if (item.compartilhada) continue;
    entregue += Number(item.entregue ?? item.votos ?? item.possivelmenteVotaram) || 0;
    faltante += Number(item.faltante ?? item.faltantes) || 0;
  }
  const cobertura = prometidos > 0 ? entregue / prometidos : 0;
  return { mode: 'default', prometidos, entregue, faltante, cobertura };
}

function summarizeFilterTotals(report, filters, cabos, subcabos) {
  const caboFilter = String(filters.caboId || '').trim();
  const subcaboFilter = String(filters.subcaboId || '').trim();
  if (!report) {
    return subcaboFilter
      ? { mode: 'subcabo', prometidos: 0, secoesExclusivas: 0 }
      : { mode: 'default', prometidos: 0, entregue: 0, faltante: 0, cobertura: 0 };
  }

  const ranking = report.cabos || [];
  const cityFilter = norm(filters.city);
  const neighborhoodFilter = norm(filters.neighborhood);
  const zoneFilter = String(filters.zone || '').trim();
  const sectionFilter = String(filters.section || '').trim();

  const selectedCaboTitle = caboFilter ? cabos.find((c) => String(c.id) === caboFilter)?.title : '';
  const selectedSubcaboTitle = subcaboFilter ? subcabos.find((s) => String(s.id) === subcaboFilter)?.title : '';
  const subFromRanking = subcaboFilter
    ? ranking.flatMap((c) => c.subcabos || []).find((s) => String(s.id) === subcaboFilter)
    : null;
  const targetSubcaboName = selectedSubcaboTitle || subFromRanking?.name || (subcaboFilter ? report.filters?.subcabo : '') || '';

  const matchesCabo = (caboObj) => {
    if (!caboFilter) return true;
    const id = caboObj.id ?? caboObj.caboId;
    const name = caboObj.name ?? caboObj.cabo;
    if (id !== undefined && id !== null && String(id) === caboFilter) return true;
    if (selectedCaboTitle && norm(name) === norm(selectedCaboTitle)) return true;
    if (ranking.length === 1 && report.filters?.cabo && norm(name) === norm(report.filters.cabo)) return true;
    return false;
  };

  const matchesSubcabo = (subObj) => {
    if (!subcaboFilter) return true;
    const id = subObj.id ?? subObj.subcaboId;
    const name = subObj.name ?? subObj.subcabo;
    if (id !== undefined && id !== null && String(id) === subcaboFilter) return true;
    if (targetSubcaboName && norm(name) === norm(targetSubcaboName)) return true;
    return false;
  };

  const matchedCabos = ranking.filter(matchesCabo);
  const hasLocationFilter = Boolean(cityFilter || neighborhoodFilter || zoneFilter || sectionFilter);

  if (subcaboFilter) {
    let prometidos = 0;
    let secoesExclusivas = 0;
    const seenExclusive = new Set();

    for (const cabo of matchedCabos) {
      const caboKey = cabo.id ?? norm(cabo.name ?? cabo.cabo);
      const subEntry = (cabo.subcabos || []).find(matchesSubcabo);

      if (!hasLocationFilter && subEntry) {
        prometidos += Number(subEntry.prometidos) || 0;
        if (subEntry.secoesExclusivas !== undefined) {
          secoesExclusivas += Number(subEntry.secoesExclusivas) || 0;
          continue;
        }
        if (typeof subEntry.secoes === 'number' && (subEntry.compartilhadas !== undefined || subEntry.secoesCompartilhadas !== undefined)) {
          secoesExclusivas += Math.max(0, subEntry.secoes - (Number(subEntry.compartilhadas ?? subEntry.secoesCompartilhadas) || 0));
          continue;
        }
      }

      for (const city of cabo.cidades || []) {
        if (cityFilter && norm(city.name ?? city.city) !== cityFilter) continue;
        for (const sub of city.subcabos || []) {
          if (!matchesSubcabo(sub)) continue;
          for (const zone of sub.zonas || []) {
            if (zoneFilter && padNum(zone.name ?? zone.zona, 2) !== padNum(zoneFilter, 2)) continue;
            for (const sec of zone.secoes || []) {
              if (sectionFilter && padNum(sec.name ?? sec.secao, 4) !== padNum(sectionFilter, 4)) continue;
              if (neighborhoodFilter && Array.isArray(sec.pessoas) && !sec.pessoas.some((p) => norm(p.bairro) === neighborhoodFilter)) {
                continue;
              }
              if (hasLocationFilter || !subEntry) {
                prometidos += Number(sec.prometidos) || 0;
              }
              const secKey = `${caboKey}|${locKey(city.name ?? city.city, zone.name ?? zone.zona, sec.name ?? sec.secao)}`;
              if (!sec.compartilhada && !seenExclusive.has(secKey)) {
                seenExclusive.add(secKey);
                secoesExclusivas += 1;
              }
            }
          }
        }
      }
    }

    return { mode: 'subcabo', prometidos, secoesExclusivas };
  }

  if (sectionFilter || zoneFilter) {
    const matchedSections = [];
    const seen = new Set();
    for (const cabo of matchedCabos) {
      const caboKey = cabo.id ?? norm(cabo.name ?? cabo.cabo);
      for (const city of cabo.cidades || []) {
        const cityName = city.name ?? city.city;
        if (cityFilter && norm(cityName) !== cityFilter) continue;
        for (const sub of city.subcabos || []) {
          for (const zone of sub.zonas || []) {
            const zoneName = zone.name ?? zone.zona;
            if (zoneFilter && padNum(zoneName, 2) !== padNum(zoneFilter, 2)) continue;
            for (const sec of zone.secoes || []) {
              const secName = sec.name ?? sec.secao;
              if (sectionFilter && padNum(secName, 4) !== padNum(sectionFilter, 4)) continue;
              if (neighborhoodFilter && Array.isArray(sec.pessoas) && !sec.pessoas.some((p) => norm(p.bairro) === neighborhoodFilter)) {
                continue;
              }
              const secKey = `${caboKey}|${locKey(cityName, zoneName, secName)}`;
              if (seen.has(secKey)) continue;
              seen.add(secKey);
              matchedSections.push({
                ...sec,
                prometidos: Number(sec.totalPrometidoNaSecao ?? sec.prometidos) || 0,
              });
            }
          }
        }
      }
    }
    return combineMetrics(matchedSections);
  }

  if (neighborhoodFilter) {
    if (!caboFilter && Array.isArray(report.cidades)) {
      const bairros = report.cidades
        .filter((c) => !cityFilter || norm(c.name ?? c.city) === cityFilter)
        .flatMap((c) => c.bairros || [])
        .filter((b) => norm(b.name ?? b.bairro) === neighborhoodFilter);
      if (bairros.length) return combineMetrics(bairros);
    }
    const bairros = [];
    for (const cabo of matchedCabos) {
      for (const city of cabo.cidades || []) {
        if (cityFilter && norm(city.name ?? city.city) !== cityFilter) continue;
        for (const bairro of city.bairros || []) {
          if (norm(bairro.name ?? bairro.bairro) === neighborhoodFilter) {
            bairros.push(bairro);
          }
        }
      }
      for (const bairro of cabo.bairros || []) {
        if (norm(bairro.name ?? bairro.bairro) === neighborhoodFilter) {
          bairros.push(bairro);
        }
      }
    }
    return combineMetrics(bairros);
  }

  if (cityFilter) {
    if (!caboFilter && Array.isArray(report.cidades)) {
      const cities = report.cidades.filter((c) => norm(c.name ?? c.city) === cityFilter);
      if (cities.length) return combineMetrics(cities);
    }
    const cities = matchedCabos.flatMap((cabo) => (cabo.cidades || []).filter((c) => norm(c.name ?? c.city) === cityFilter));
    return combineMetrics(cities);
  }

  if (caboFilter) {
    return combineMetrics(matchedCabos);
  }

  if (report.totals && (report.totals.entregue !== undefined || report.totals.prometidos !== undefined)) {
    return combineMetrics([report.totals]);
  }
  if (report.entregue !== undefined || report.prometidos !== undefined) {
    return combineMetrics([report]);
  }
  return combineMetrics(ranking);
}

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
  const [baseReport, setBaseReport] = useState(null);
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

  useEffect(() => {
    setReport(null);
    setBaseReport(null);
  }, [candidateName]);

  const activeFilterCount = Object.values(filters).filter((value) => String(value).trim()).length;

  const query = useMemo(() => {
    const params = new URLSearchParams({ candidateName });
    for (const [name, value] of Object.entries(filters)) {
      if (String(value).trim()) params.set(name, String(value).trim());
    }
    return `?${params.toString()}`;
  }, [candidateName, filters]);

  useEffect(() => {
    if (!candidateName) { setReport(null); setBaseReport(null); return; }
    let active = true;
    setLoading(true);
    setError('');
    api(`/elections/inteligencia-eleitoral${query}`)
      .then((data) => {
        if (!active) return;
        setReport(data);
        if (!activeFilterCount) setBaseReport(data);
        else setBaseReport((prev) => prev || data);
      })
      .catch((e) => { if (active) { setReport(null); setError(e.message || 'Não foi possível carregar os relatórios.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [candidateName, query, activeFilterCount]);

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

  const summarySource = baseReport || report;
  const totals = useMemo(() => {
    const fromCurrent = !loading && report ? summarizeFilterTotals(report, filters, cabos, subcabos) : null;
    if (fromCurrent && (fromCurrent.prometidos > 0 || fromCurrent.entregue > 0 || fromCurrent.faltante > 0 || fromCurrent.secoesExclusivas > 0 || !baseReport)) {
      return fromCurrent;
    }
    return summarizeFilterTotals(summarySource, filters, cabos, subcabos);
  }, [report, baseReport, summarySource, loading, filters, cabos, subcabos]);

  const missing = report?.missingSections || [];
  const ranking = report?.cabos || [];
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
            {summarySource && (
              <div className="election-metrics election-filter-totals" role="region" aria-label="Resumo dos filtros">
                {totals.mode === 'subcabo' ? (
                  <>
                    <div>
                      <strong data-testid="filter-total-prometidos">{count(totals.prometidos)}</strong>
                      <span>Prometidos</span>
                    </div>
                    <div>
                      <strong data-testid="filter-total-secoes-exclusivas">{count(totals.secoesExclusivas)}</strong>
                      <span>Seções exclusivas</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong data-testid="filter-total-prometidos">{count(totals.prometidos)}</strong>
                      <span>Prometidos</span>
                    </div>
                    <div>
                      <strong data-testid="filter-total-entregue">{count(totals.entregue)}</strong>
                      <span>Entregues</span>
                    </div>
                    <div className="election-metric-missing">
                      <strong data-testid="filter-total-faltantes">{count(totals.faltante)}</strong>
                      <span>Faltantes</span>
                    </div>
                    <div>
                      <strong data-testid="filter-total-cobertura">{formatCoverage(totals.cobertura)}</strong>
                      <span>Cobertura</span>
                    </div>
                  </>
                )}
              </div>
            )}
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
                        <div><strong>{count(section.entregue ?? section.possivelmenteVotaram)}</strong><span>Possivelmente votaram</span></div>
                        <div className="election-metric-missing"><strong>{count(section.faltante ?? section.faltantes)}</strong><span>Possíveis faltantes · {percent(section.percentualFaltantes)}</span></div>
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
