import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, apiDownload, getUser } from '../lib/api';
import './Crossing.css';

const count = (value) => Number(value || 0).toLocaleString('pt-BR');
const percent = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const norm = (value) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
const padNum = (value, width) => {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? String(n).padStart(width, '0') : String(value ?? '').trim();
};
const locKey = (city, zone, section) => `${norm(city)}|${padNum(zone, 2)}|${padNum(section, 4)}`;

function summarizeFilterTotals(report, filters, cabos, subcabos) {
  if (!report) return { prometidos: 0, apurados: 0, faltantes: 0 };
  const ranking = report.cabos || [];
  const missing = report.missingSections || [];
  const caboFilter = String(filters.caboId || '').trim();
  const subcaboFilter = String(filters.subcaboId || '').trim();
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
    if (Array.isArray(subObj.zonas) && subObj.zonas.some((z) => (z.secoes || []).some((s) => (s.pessoas || []).some((p) => String(p.subcaboId) === subcaboFilter)))) {
      return true;
    }
    return false;
  };

  const matchesLocation = (city, zone, section, pessoas) => {
    if (cityFilter && norm(city) !== cityFilter) return false;
    if (zoneFilter && padNum(zone, 2) !== padNum(zoneFilter, 2)) return false;
    if (sectionFilter && padNum(section, 4) !== padNum(sectionFilter, 4)) return false;
    if (neighborhoodFilter && Array.isArray(pessoas) && pessoas.length > 0) {
      if (!pessoas.some((p) => norm(p.bairro) === neighborhoodFilter)) return false;
    }
    return true;
  };

  const missingByCaboLoc = new Map();
  const missingByLoc = new Map();
  for (const ms of missing) {
    const lKey = locKey(ms.city, ms.zona, ms.secao);
    const cKey = `${ms.caboId ?? norm(ms.cabo)}|${lKey}`;
    missingByCaboLoc.set(cKey, ms);
    if (!missingByLoc.has(lKey)) missingByLoc.set(lKey, ms);
  }

  const matchedCabos = ranking.filter(matchesCabo);
  const hasLocationFilter = Boolean(cityFilter || neighborhoodFilter || zoneFilter || sectionFilter);

  if (!subcaboFilter) {
    let prometidos = 0;
    let apurados = 0;
    let faltantes = 0;
    const seenSections = new Set();

    for (const cabo of matchedCabos) {
      const caboKey = cabo.id ?? norm(cabo.name);
      const hasDirectTotals = (cabo.apurado !== undefined || cabo.apurados !== undefined) && cabo.faltantes !== undefined && !hasLocationFilter;
      if (hasDirectTotals) {
        prometidos += Number(cabo.prometidos) || 0;
        apurados += Number(cabo.apurado ?? cabo.apurados) || 0;
        faltantes += Number(cabo.faltantes) || 0;
        continue;
      }

      let caboPrometidosFromSections = 0;
      let hasSectionsInHierarchy = false;
      for (const city of cabo.cidades || []) {
        for (const sub of city.subcabos || []) {
          for (const zone of sub.zonas || []) {
            for (const sec of zone.secoes || []) {
              hasSectionsInHierarchy = true;
              if (!matchesLocation(city.name, zone.name, sec.name, sec.pessoas)) continue;
              const peopleCount = neighborhoodFilter && Array.isArray(sec.pessoas)
                ? sec.pessoas.filter((p) => norm(p.bairro) === neighborhoodFilter).length
                : (Number(sec.prometidos) || 0);
              caboPrometidosFromSections += peopleCount;

              const lKey = locKey(city.name, zone.name, sec.name);
              const secKey = `${caboKey}|${lKey}`;
              if (seenSections.has(secKey)) continue;
              seenSections.add(secKey);

              const ms = missingByCaboLoc.get(secKey) || missingByLoc.get(lKey);
              const secApurado = sec.apuradoTseNaSecao !== undefined
                ? (Number(sec.apuradoTseNaSecao) || 0)
                : (Number(ms?.apuradoTseNaSecao ?? ms?.apurado ?? sec.apurado) || 0);
              const secFaltantes = (sec.faltantes !== undefined && sec.faltantes !== null)
                ? (Number(sec.faltantes) || 0)
                : (Number(ms?.faltantes) || 0);
              apurados += secApurado;
              faltantes += secFaltantes;
            }
          }
        }
      }

      if (!hasLocationFilter && cabo.prometidos !== undefined) {
        prometidos += Number(cabo.prometidos) || 0;
      } else {
        prometidos += hasSectionsInHierarchy ? caboPrometidosFromSections : (Number(cabo.prometidos) || 0);
      }
    }

    for (const ms of missing) {
      if (!matchesCabo(ms)) continue;
      if (!matchesLocation(ms.city, ms.zona, ms.secao, ms.pessoas)) continue;
      const lKey = locKey(ms.city, ms.zona, ms.secao);
      const secKey = `${ms.caboId ?? norm(ms.cabo)}|${lKey}`;
      if (seenSections.has(secKey)) continue;
      seenSections.add(secKey);
      if (!matchedCabos.length) prometidos += Number(ms.prometidos) || 0;
      apurados += Number(ms.apuradoTseNaSecao ?? ms.apurado) || 0;
      faltantes += Number(ms.faltantes) || 0;
    }

    return { prometidos, apurados, faltantes };
  }

  let prometidos = 0;
  let apurados = 0;
  let faltantes = 0;
  const seenSubSections = new Set();

  for (const cabo of matchedCabos) {
    const caboKey = cabo.id ?? norm(cabo.name);
    const subEntry = (cabo.subcabos || []).find(matchesSubcabo);
    const hasDirectSubTotals = subEntry && (subEntry.apurado !== undefined || subEntry.apurados !== undefined) && subEntry.faltantes !== undefined && !hasLocationFilter;
    if (hasDirectSubTotals) {
      prometidos += Number(subEntry.prometidos) || 0;
      apurados += Number(subEntry.apurado ?? subEntry.apurados) || 0;
      faltantes += Number(subEntry.faltantes) || 0;
      continue;
    }

    let subPrometidosFromSections = 0;
    let foundSubInCidades = false;
    for (const city of cabo.cidades || []) {
      for (const sub of city.subcabos || []) {
        if (!matchesSubcabo(sub)) continue;
        foundSubInCidades = true;
        for (const zone of sub.zonas || []) {
          for (const sec of zone.secoes || []) {
            if (!matchesLocation(city.name, zone.name, sec.name, sec.pessoas)) continue;
            const secProm = neighborhoodFilter && Array.isArray(sec.pessoas)
              ? sec.pessoas.filter((p) => norm(p.bairro) === neighborhoodFilter).length
              : (Number(sec.prometidos) || 0);
            subPrometidosFromSections += secProm;

            const lKey = locKey(city.name, zone.name, sec.name);
            const cSecKey = `${caboKey}|${lKey}`;
            const subSecKey = `${caboKey}|${norm(sub.name)}|${lKey}`;
            if (seenSubSections.has(subSecKey)) continue;
            seenSubSections.add(subSecKey);

            const ms = missingByCaboLoc.get(cSecKey) || missingByLoc.get(lKey);
            const secApurado = sec.apuradoTseNaSecao !== undefined
              ? (Number(sec.apuradoTseNaSecao) || 0)
              : (Number(ms?.apuradoTseNaSecao ?? ms?.apurado ?? sec.apurado) || 0);
            let secFaltantes = 0;
            if (sec.apuracaoDisponivel === true) {
              secFaltantes = Math.max(0, secProm - secApurado);
            } else if (sec.apuracaoDisponivel === false) {
              secFaltantes = 0;
            } else if (sec.faltantes !== undefined && sec.faltantes !== null) {
              secFaltantes = Number(sec.faltantes) || 0;
            } else if (ms) {
              secFaltantes = ms.apuradoTseNaSecao !== undefined
                ? Math.max(0, secProm - (Number(ms.apuradoTseNaSecao) || 0))
                : (Number(ms.faltantes) || 0);
            }
            apurados += secApurado;
            faltantes += secFaltantes;
          }
        }
      }
    }

    if (!hasLocationFilter && subEntry?.prometidos !== undefined) {
      prometidos += Number(subEntry.prometidos) || 0;
    } else if (foundSubInCidades) {
      prometidos += subPrometidosFromSections;
    } else if (subEntry?.prometidos !== undefined) {
      prometidos += Number(subEntry.prometidos) || 0;
    }
  }

  for (const ms of missing) {
    if (!matchesCabo(ms)) continue;
    if (!matchesLocation(ms.city, ms.zona, ms.secao, ms.pessoas)) continue;
    const matchingPeople = (ms.pessoas || []).filter(matchesSubcabo);
    if (!matchingPeople.length) continue;
    const lKey = locKey(ms.city, ms.zona, ms.secao);
    const caboKey = ms.caboId ?? norm(ms.cabo);
    const subName = matchingPeople[0]?.subcabo || targetSubcaboName;
    const subSecKey = `${caboKey}|${norm(subName)}|${lKey}`;
    if (seenSubSections.has(subSecKey)) continue;
    seenSubSections.add(subSecKey);
    const secProm = matchingPeople.length;
    const secApurado = Number(ms.apuradoTseNaSecao ?? ms.apurado) || 0;
    if (!prometidos) prometidos += secProm;
    apurados += secApurado;
    faltantes += Math.max(0, secProm - secApurado);
  }

  return { prometidos, apurados, faltantes };
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
    if (fromCurrent && (fromCurrent.prometidos > 0 || fromCurrent.apurados > 0 || fromCurrent.faltantes > 0 || !baseReport)) {
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
                <div>
                  <strong data-testid="filter-total-prometidos">{count(totals.prometidos)}</strong>
                  <span>Prometidos</span>
                </div>
                <div>
                  <strong data-testid="filter-total-apurados">{count(totals.apurados)}</strong>
                  <span>Apurados</span>
                </div>
                <div className="election-metric-missing">
                  <strong data-testid="filter-total-faltantes">{count(totals.faltantes)}</strong>
                  <span>Faltantes</span>
                </div>
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
