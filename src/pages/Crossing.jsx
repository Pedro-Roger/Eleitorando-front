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

function combineMetrics(items = []) {
  if (!items.length) {
    return { mode: 'default', prometidos: 0, entregue: 0, faltante: 0, prometidosSemApuracao: 0, cobertura: 0 };
  }
  if (items.length === 1) {
    const item = items[0];
    const prometidos = Number(item.prometidos) || 0;
    const entregue = Number(item.entregue) || 0;
    const faltante = Number(item.faltante) || 0;
    const prometidosSemApuracao = Number(item.prometidosSemApuracao) || 0;
    const cobertura = item.cobertura !== undefined
      ? Number(item.cobertura) || 0
      : (prometidos > 0 ? entregue / prometidos : 0);
    return { mode: 'default', prometidos, entregue, faltante, prometidosSemApuracao, cobertura };
  }
  let prometidos = 0;
  let entregue = 0;
  let faltante = 0;
  let prometidosSemApuracao = 0;
  for (const item of items) {
    prometidos += Number(item.prometidos) || 0;
    if (item.compartilhada) continue;
    if (item.apuracaoDisponivel === false) {
      prometidosSemApuracao += Number(item.prometidos) || 0;
      continue;
    }
    entregue += Number(item.entregue) || 0;
    faltante += Number(item.faltante) || 0;
    prometidosSemApuracao += Number(item.prometidosSemApuracao) || 0;
  }
  const cobertura = prometidos > 0 ? entregue / prometidos : 0;
  return { mode: 'default', prometidos, entregue, faltante, prometidosSemApuracao, cobertura };
}

function summarizeFilterTotals(report, filters, cabos, subcabos) {
  const caboFilter = String(filters.caboId || '').trim();
  const subcaboFilter = String(filters.subcaboId || '').trim();
  if (!report) {
    return subcaboFilter
      ? { mode: 'subcabo', prometidos: 0, secoesExclusivas: 0 }
      : { mode: 'default', prometidos: 0, entregue: 0, faltante: 0, prometidosSemApuracao: 0, cobertura: 0 };
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
  const targetSubcaboName = selectedSubcaboTitle || subFromRanking?.name || '';

  const matchedCabos = caboFilter
    ? ranking.filter((c) => String(c.id) === caboFilter || (selectedCaboTitle && norm(c.name) === norm(selectedCaboTitle)))
    : ranking;

  const matchesSubcabo = (sub) => (
    (sub.id !== undefined && String(sub.id) === subcaboFilter)
    || (targetSubcaboName && norm(sub.name) === norm(targetSubcaboName))
  );
  const hasLocationFilter = Boolean(cityFilter || neighborhoodFilter || zoneFilter || sectionFilter);

  if (subcaboFilter) {
    let prometidos = 0;
    let secoesExclusivas = 0;
    const seenExclusive = new Set();

    for (const cabo of matchedCabos) {
      const subEntry = (cabo.subcabos || []).find(matchesSubcabo);
      if (!hasLocationFilter && subEntry) {
        prometidos += Number(subEntry.prometidos) || 0;
        if (typeof subEntry.secoes === 'number' && typeof subEntry.compartilhadas === 'number') {
          secoesExclusivas += Math.max(0, subEntry.secoes - subEntry.compartilhadas);
          continue;
        }
      }

      for (const city of cabo.cidades || []) {
        if (cityFilter && norm(city.name) !== cityFilter) continue;
        for (const sub of (city.subcabos || []).filter(matchesSubcabo)) {
          const zones = sub.bairros ? sub.bairros.flatMap((b) => b.zonas || []) : (sub.zonas || []);
          for (const zone of zones) {
            if (zoneFilter && padNum(zone.name, 2) !== padNum(zoneFilter, 2)) continue;
            for (const sec of zone.secoes || []) {
              if (sectionFilter && padNum(sec.name, 4) !== padNum(sectionFilter, 4)) continue;
              if (neighborhoodFilter && !(sec.pessoas || []).some((p) => norm(p.bairro) === neighborhoodFilter)) continue;
              if (hasLocationFilter || !subEntry) prometidos += Number(sec.prometidos) || 0;
              const secKey = `${cabo.id}|${locKey(city.name, zone.name, sec.name)}`;
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
      for (const city of cabo.cidades || []) {
        if (cityFilter && norm(city.name) !== cityFilter) continue;
        for (const sub of city.subcabos || []) {
          const zones = sub.bairros ? sub.bairros.flatMap((b) => b.zonas || []) : (sub.zonas || []);
          for (const zone of zones) {
            if (zoneFilter && padNum(zone.name, 2) !== padNum(zoneFilter, 2)) continue;
            for (const sec of zone.secoes || []) {
              if (sectionFilter && padNum(sec.name, 4) !== padNum(sectionFilter, 4)) continue;
              if (neighborhoodFilter && !(sec.pessoas || []).some((p) => norm(p.bairro) === neighborhoodFilter)) continue;
              const secKey = `${cabo.id}|${locKey(city.name, zone.name, sec.name)}`;
              if (seen.has(secKey)) continue;
              seen.add(secKey);
              matchedSections.push(sec);
            }
          }
        }
      }
    }
    return combineMetrics(matchedSections);
  }

  if (neighborhoodFilter) {
    const cities = matchedCabos.flatMap((c) => c.cidades || []).filter((c) => !cityFilter || norm(c.name) === cityFilter);
    const cityBairros = cities.flatMap((c) => c.bairros || []).filter((b) => norm(b.name) === neighborhoodFilter);
    const subBairros = cities
      .flatMap((c) => c.subcabos || [])
      .flatMap((s) => s.bairros || [])
      .filter((b) => norm(b.name) === neighborhoodFilter);
    return combineMetrics(cityBairros.length ? cityBairros : subBairros);
  }

  if (cityFilter) {
    const cities = matchedCabos.flatMap((c) => c.cidades || []).filter((c) => norm(c.name) === cityFilter);
    return combineMetrics(cities);
  }

  if (caboFilter) return combineMetrics(matchedCabos);
  return combineMetrics(report.totais ? [report.totais] : []);
}

function exclusiveSectionsOfSubcabo(cabo, subcabo) {
  const fromCabo = (cabo.subcabos || []).find(
    (s) => (s.id !== undefined && String(s.id) === String(subcabo.id)) || norm(s.name) === norm(subcabo.name)
  );
  if (fromCabo && typeof fromCabo.secoes === 'number' && typeof fromCabo.compartilhadas === 'number') {
    return Math.max(0, fromCabo.secoes - fromCabo.compartilhadas);
  }
  if (typeof subcabo.secoes === 'number' && typeof subcabo.compartilhadas === 'number') {
    return Math.max(0, subcabo.secoes - subcabo.compartilhadas);
  }
  const zones = subcabo.bairros ? subcabo.bairros.flatMap((b) => b.zonas || []) : (subcabo.zonas || []);
  const seen = new Set();
  for (const zone of zones) {
    for (const sec of zone.secoes || []) {
      if (!sec.compartilhada) seen.add(`${zone.name}|${sec.name}`);
    }
  }
  return seen.size;
}

function bairrosOfSubcabo(subcabo, city) {
  if (Array.isArray(subcabo.bairros)) return subcabo.bairros;
  const cityBairroMap = new Map((city.bairros || []).map((b) => [norm(b.name), b]));
  const byBairro = new Map();
  for (const zone of subcabo.zonas || []) {
    for (const sec of zone.secoes || []) {
      const bairroName = sec.pessoas?.[0]?.bairro || 'Bairro não informado';
      const bKey = norm(bairroName);
      const cityBairro = cityBairroMap.get(bKey);
      const entry = byBairro.get(bKey) || {
        name: cityBairro?.name || bairroName,
        prometidos: cityBairro ? Number(cityBairro.prometidos) || 0 : 0,
        entregue: cityBairro ? Number(cityBairro.entregue) || 0 : 0,
        faltante: cityBairro ? Number(cityBairro.faltante) || 0 : 0,
        fromCity: Boolean(cityBairro),
        zonas: new Map(),
      };
      if (!entry.fromCity) {
        entry.prometidos += Number(sec.prometidos) || 0;
        if (!sec.compartilhada) {
          entry.entregue += Number(sec.entregue) || 0;
          entry.faltante += Number(sec.faltante) || 0;
        }
      }
      const zEntry = entry.zonas.get(zone.name) || { name: zone.name, prometidos: 0, secoes: [] };
      zEntry.prometidos += Number(sec.prometidos) || 0;
      zEntry.secoes.push(sec);
      entry.zonas.set(zone.name, zEntry);
      byBairro.set(bKey, entry);
    }
  }
  return [...byBairro.values()].map((b) => ({
    name: b.name,
    prometidos: b.prometidos,
    entregue: b.entregue,
    faltante: b.faltante,
    zonas: [...b.zonas.values()],
  }));
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
    if (
      fromCurrent &&
      (fromCurrent.prometidos > 0 ||
        fromCurrent.entregue > 0 ||
        fromCurrent.faltante > 0 ||
        fromCurrent.prometidosSemApuracao > 0 ||
        fromCurrent.secoesExclusivas > 0 ||
        !baseReport)
    ) {
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
                    <div className="election-metric-small">
                      <strong data-testid="filter-total-sem-apuracao">{count(totals.prometidosSemApuracao)}</strong>
                      <span>Sem apuração TSE</span>
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
                        <div><strong>{count(section.entregue)}</strong><span>Entregue (TSE)</span></div>
                        <div className="election-metric-missing"><strong>{count(section.faltante)}</strong><span>Faltante · {percent(section.percentualFaltantes)}</span></div>
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
                    <div>
                      <h3 id="summary-title">Resumo por cabo e subcabo</h3>
                      {(!filters.caboId || !filters.subcaboId) && (
                        <p>
                          {!filters.caboId
                            ? 'Selecione um cabo nos filtros para habilitar o relatório por cabo, e um subcabo para o relatório por subcabo.'
                            : 'Selecione um subcabo nos filtros para habilitar o relatório por subcabo.'}
                        </p>
                      )}
                    </div>
                    <div className="election-download-actions">
                      <button className="election-download" type="button" onClick={() => download('relatorio-geral')}>
                        Baixar relatório geral
                      </button>
                      <button className="election-download secondary" type="button" disabled={!filters.caboId} onClick={() => download('relatorio-cabo')}>
                        Baixar relatório por cabo
                      </button>
                      <button className="election-download secondary" type="button" disabled={!filters.subcaboId} onClick={() => download('relatorio-subcabo')}>
                        Baixar relatório por subcabo
                      </button>
                    </div>
                  </div>
                  {!ranking.length ? <div className="empty">Nenhum cadastro para os filtros.</div> : ranking.map((cabo) => (
                    <div key={cabo.id} className="election-summary-cabo">
                      <h4>
                        Cabo: {cabo.name}{' '}
                        <span>
                          {count(cabo.prometidos)} prometidos · {count(cabo.entregue)} entregue · {count(cabo.faltante)} faltante · {formatCoverage(cabo.cobertura)} cobertura
                        </span>
                      </h4>
                      <p>{count(cabo.secoes)} seções · {count(cabo.secoesComFaltantes)} com diferença numérica</p>
                      {cabo.cidades.map((city) => (
                        <div key={city.name} className="election-summary-city">
                          <h5>Cidade: {city.name} <span>{count(city.prometidos)} prometidos</span></h5>
                          {city.subcabos.map((subcabo) => (
                            <div key={subcabo.name} className="election-summary-subcabo">
                              <strong>
                                Subcabo: {subcabo.name}{' '}
                                <span>
                                  {count(subcabo.prometidos)} prometidos · {count(exclusiveSectionsOfSubcabo(cabo, subcabo))} seções exclusivas
                                </span>
                              </strong>
                              {bairrosOfSubcabo(subcabo, city).map((bairro) => (
                                <div key={bairro.name} className="election-summary-bairro">
                                  <strong>
                                    Bairro: {bairro.name}{' '}
                                    <span>
                                      {count(bairro.prometidos)} prometidos · {count(bairro.entregue)} entregue · {count(bairro.faltante)} faltante
                                    </span>
                                  </strong>
                                  {bairro.zonas.map((zone) => (
                                    <div key={zone.name} className="election-summary-zone">
                                      <b>Zona {zone.name}</b> <span>{count(zone.prometidos)} prometidos</span>
                                      {zone.secoes.map((section) => (
                                        <div key={section.name} className="election-summary-section">
                                          <div>
                                            Zona {zone.name} · Seção {section.name}{' '}
                                            <span>
                                              {count(section.prometidos)} prometidos ·{' '}
                                              {section.compartilhada
                                                ? 'Compartilhada, sem atribuição'
                                                : `${count(section.entregue)} entregue (TSE) · ${count(section.faltante)} faltante`}
                                            </span>
                                          </div>
                                          <ul className="election-summary-people">
                                            {(section.pessoas || []).map((person, index) => (
                                              <li key={`${person.name}-${index}`}>
                                                {!section.compartilhada && section.faltante > 0
                                                  ? `${person.name} — Voto faltante possível`
                                                  : person.name}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
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
