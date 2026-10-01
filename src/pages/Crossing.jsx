import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { api, getUser } from '../lib/api';

// Cruzamento "Previsto vs Realizado" (visão de um único político): Realizado =
// apurado oficial do TSE (eleição passada); Previsto = eleitores cadastrados na
// campanha atribuídos ao mesmo político. O badge de meta compara o previsto com
// o realizado dele mesmo.
const PAST_YEAR = 2022;
const TURN = 1;
// Cargos presentes na base TSE (fallback quando /elections/offices falha).
// DEPUTADO ESTADUAL primeiro: é onde corre a candidata principal (Keiva Dias).
const DEFAULT_OFFICES = ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'];
const DEFAULT_OFFICE = DEFAULT_OFFICES[0];
const COLORS = { realizado: '#10B981', previsto: '#94A3B8' };

const turnLabel = { 1: '1º Turno', 2: '2º Turno' };

// Compara nomes ignorando acentos, caixa e espaços extras.
function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Soma os votos (lado TSE) ou eleitores (lado atual) de um nome na lista.
function sumFor(rows, name) {
  const key = normalize(name);
  return rows.reduce((sum, r) => (normalize(r.name) === key ? sum + (r.votes ?? r.voters ?? 0) : sum), 0);
}

// Barra horizontal proporcional ao máximo da série, com o valor absoluto à direita.
function Bar({ label, value, max, color }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span className="meta" style={{ width: 64 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F1F5F9' }}>
        <div style={{ width: `${width}%`, height: 8, borderRadius: 4, background: color }} />
      </div>
      <span className="meta" style={{ width: 72, textAlign: 'right' }}>{value.toLocaleString('pt-BR')}</span>
    </div>
  );
}

// Badge de meta do político selecionado: Previsto (eleitores cadastrados) vs
// Realizado (apurado TSE 2022 do próprio político).
function MetaBadge({ previsto, realizado }) {
  const verde = { background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 8, borderRadius: 6, color: '#065F46', textAlign: 'center', fontWeight: 'bold' };
  const cinza = { background: '#F1F5F9', border: '1px solid #E2E8F0', padding: 8, borderRadius: 6, color: '#475569', textAlign: 'center', fontWeight: 'bold' };

  if (previsto === 0 && realizado === 0) {
    return <div style={cinza}>Sem dados de meta</div>;
  }

  const batida = (previsto >= realizado && realizado > 0) || (previsto > 0 && realizado === 0);
  if (batida) {
    return (
      <div style={verde}>
        <Icon name="trending_up" size={16} /> Meta batida — previsto ≥ realizado
      </div>
    );
  }

  const cobertura = Math.round((previsto / realizado) * 1000) / 10;
  return (
    <div style={cinza}>
      Meta pendente — {cobertura.toLocaleString('pt-BR')}% do realizado
    </div>
  );
}

export default function Crossing() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';
  const [data, setData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  // Lista statewide do TSE (todas as cidades, agregada por nome) — alimenta o
  // seletor de políticos mesmo quando o candidato só votou em cidades pequenas.
  const [tseCandidates, setTseCandidates] = useState([]);
  const [error, setError] = useState('');
  const [office, setOffice] = useState(DEFAULT_OFFICE);
  const [offices, setOffices] = useState(DEFAULT_OFFICES);
  const [politico, setPolitico] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    // Cargos reais da base TSE; em caso de falha, mantém o fallback padrão.
    api('/elections/offices')
      .then((r) => { if (Array.isArray(r.offices) && r.offices.length) setOffices(r.offices); })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setData(null);
    Promise.all([
      // limit=999: CE tem ~184 municípios — mostra todas as cidades do político
      api(`/elections/comparativo?pastYear=${PAST_YEAR}&office=${encodeURIComponent(office)}&turn=${TURN}&limit=999`),
      api('/candidates'),
      // Refetched junto com o comparativo: candidatos statewide do cargo/ano
      api(`/elections/candidates?year=${PAST_YEAR}&office=${encodeURIComponent(office)}&turn=${TURN}`),
    ])
      .then(([comp, cand, tse]) => {
        setData(comp);
        setCandidates(cand.candidates || []);
        setTseCandidates(tse.candidates || []);
      })
      .catch((e) => setError(e.message));
  }, [isAdmin, office]);

  // Opções = união dos candidatos cadastrados (grafia preferida) e dos nomes
  // statewide da base TSE (eleição passada, todas as cidades), dedupe por nome
  // normalizado.
  const options = useMemo(() => {
    const byKey = new Map();
    for (const c of candidates) byKey.set(normalize(c.name), c.name);
    for (const c of tseCandidates) {
      const key = normalize(c.candidateName);
      if (key && !byKey.has(key)) byKey.set(key, c.candidateName);
    }
    return [...byKey.values()];
  }, [candidates, tseCandidates]);

  // Total de votos TSE (passada) por nome normalizado — usado no padrão abaixo.
  const votesByKey = useMemo(() => {
    const byKey = new Map();
    for (const c of tseCandidates) {
      const key = normalize(c.candidateName);
      byKey.set(key, (byKey.get(key) || 0) + (c.votes || 0));
    }
    return byKey;
  }, [tseCandidates]);

  // Padrão (em ordem): nome exato "keiva dias"; nome que começa com "keiv" e
  // contém "dias" (ex.: KEIVILANNY DIAS MOURA GONÇALVES, nome TSE); qualquer
  // nome contendo "keiva"; primeiro com votos > 0; primeira opção.
  const pickDefault = (opts) =>
    opts.find((n) => normalize(n) === 'keiva dias') ||
    opts.find((n) => { const k = normalize(n); return k.startsWith('keiv') && k.includes('dias'); }) ||
    opts.find((n) => normalize(n).includes('keiva')) ||
    opts.find((n) => (votesByKey.get(normalize(n)) || 0) > 0) ||
    opts[0];

  useEffect(() => {
    if (!options.length) return;
    setPolitico(pickDefault(options));
  }, [options, votesByKey]);

  // Realizado (TSE) e Previsto (base da campanha) do político selecionado,
  // total e por cidade.
  const result = useMemo(() => {
    if (!data || !politico) return null;
    const perCity = data.cities.map((city) => ({
      city: city.city,
      past: sumFor(city.past, politico),
      current: sumFor(city.current, politico),
    }));
    return {
      perCity,
      pastTotal: perCity.reduce((s, c) => s + c.past, 0),
      currentTotal: perCity.reduce((s, c) => s + c.current, 0),
    };
  }, [data, politico]);

  const maxPast = result ? Math.max(...result.perCity.map((c) => c.past)) : 0;
  const maxCurrent = result ? Math.max(...result.perCity.map((c) => c.current)) : 0;
  const citiesWithData = result
    ? result.perCity.filter((c) => c.past + c.current > 0)
    : [];

  if (!isAdmin) {
    return (
      <>
        <AppHeader title="Inteligência Eleitoral" />
        <div className="page"><div className="alert error">Acesso restrito ao administrador.</div></div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Resultado da eleição"
        subtitle={`${office} ${data?.pastYear || PAST_YEAR} — ${turnLabel[data?.turn ?? TURN] || `${data?.turn}º Turno`}`}
      />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <div className="empty">Carregando...</div>}

        {data && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="panel-title">Resultado {office} {data.pastYear}</h2>
              <div className="field">
                <label>Cargo (eleição {data?.pastYear || PAST_YEAR})</label>
                <select value={office} onChange={(e) => setOffice(e.target.value)}>
                  {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Político</label>
                <select value={politico} onChange={(e) => setPolitico(e.target.value)}>
                  {options.map((n) => <option key={normalize(n)} value={n}>{n}</option>)}
                </select>
              </div>

              {!result && <div className="meta">Nenhum político disponível para este cargo.</div>}
              {result && (
                <>
                  <MetaBadge previsto={result.currentTotal} realizado={result.pastTotal} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
                    <div>
                      <div className="meta">Realizado</div>
                      <strong style={{ fontSize: 24 }}>{result.pastTotal.toLocaleString('pt-BR')}</strong>
                      <div className="meta">apurado oficial TSE {data.pastYear}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="meta">Previsto</div>
                      <strong style={{ fontSize: 24 }}>{result.currentTotal.toLocaleString('pt-BR')}</strong>
                      <div className="meta">base da campanha (eleitores cadastrados)</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {result && (
              <div className="card">
                <h3 className="panel-title">Por Cidade</h3>
                {citiesWithData.length === 0 && (
                  <div className="meta">Sem dados para o político selecionado.</div>
                )}
                {citiesWithData.map((c) => (
                  <div key={c.city} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.city}</div>
                    <Bar label="Realizado" value={c.past} max={maxPast} color={COLORS.realizado} />
                    <Bar label="Previsto" value={c.current} max={maxCurrent} color={COLORS.previsto} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
