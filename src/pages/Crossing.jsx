import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { api, getUser } from '../lib/api';

// Cruzamento: votos oficiais do TSE (eleição passada) vs intenção de voto
// dos eleitores cadastrados, confrontando dois candidatos por cidade.
const PAST_YEAR = 2022;
const TURN = 1;
// Cargos presentes na base TSE (fallback quando /elections/offices falha).
// DEPUTADO ESTADUAL primeiro: é onde corre a candidata principal (Keiva Dias).
const DEFAULT_OFFICES = ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'];
const DEFAULT_OFFICE = DEFAULT_OFFICES[0];
const COLORS = { mine: '#10B981', theirs: '#94A3B8' };

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

const pct = (a, b) => (a + b > 0 ? (a / (a + b)) * 100 : 0);

function SplitBar({ minePct }) {
  return (
    <div style={{ display: 'flex', height: 8, marginTop: 12, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${minePct}%`, background: COLORS.mine }}></div>
      <div style={{ width: `${100 - minePct}%`, background: COLORS.theirs }}></div>
    </div>
  );
}

function Totals({ mine, theirs, mineTotal, theirsTotal }) {
  const minePct = pct(mineTotal, theirsTotal);
  const diff = minePct - (100 - minePct);
  const ahead = mineTotal > theirsTotal;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <div><strong>{mine}</strong><br /><span className="meta">{mineTotal.toLocaleString('pt-BR')} — {minePct.toFixed(1)}%</span></div>
        <div style={{ textAlign: 'right' }}><strong>{theirs}</strong><br /><span className="meta">{theirsTotal.toLocaleString('pt-BR')} — {(100 - minePct).toFixed(1)}%</span></div>
      </div>

      {ahead ? (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 8, borderRadius: 6, color: '#065F46', textAlign: 'center', fontWeight: 'bold' }}>
          <Icon name="trending_up" size={16} /> {mine} +{Math.abs(diff).toFixed(1)}% (Vantagem)
        </div>
      ) : (
        <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: 8, borderRadius: 6, color: '#475569', textAlign: 'center', fontWeight: 'bold' }}>
          {theirs} +{Math.abs(diff).toFixed(1)}% (Desvantagem)
        </div>
      )}

      <SplitBar minePct={minePct} />
    </>
  );
}

export default function Crossing() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';
  const [data, setData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [office, setOffice] = useState(DEFAULT_OFFICE);
  const [offices, setOffices] = useState(DEFAULT_OFFICES);
  const [mine, setMine] = useState('');
  const [theirs, setTheirs] = useState('');

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
      api(`/elections/comparativo?pastYear=${PAST_YEAR}&office=${encodeURIComponent(office)}&turn=${TURN}`),
      api('/candidates'),
    ])
      .then(([comp, cand]) => {
        setData(comp);
        setCandidates(cand.candidates || []);
      })
      .catch((e) => setError(e.message));
  }, [isAdmin, office]);

  // Opções = união dos candidatos cadastrados e dos nomes do lado TSE (passada).
  const options = useMemo(() => {
    if (!data) return [];
    const byKey = new Map();
    for (const c of candidates) byKey.set(normalize(c.name), c.name);
    for (const city of data.cities) {
      for (const p of city.past) {
        const key = normalize(p.name);
        if (key && !byKey.has(key)) byKey.set(key, p.name);
      }
    }
    return [...byKey.values()];
  }, [data, candidates]);

  // Total de votos TSE (passada) por nome normalizado — usado nos padrões abaixo.
  const votesByKey = useMemo(() => {
    const byKey = new Map();
    if (!data) return byKey;
    for (const city of data.cities) {
      for (const p of city.past) {
        const key = normalize(p.name);
        byKey.set(key, (byKey.get(key) || 0) + (p.votes || 0));
      }
    }
    return byKey;
  }, [data]);

  // Padrão "Meu candidato" (em ordem): nome exato "keiva dias"; nome que começa
  // com "keiv" e contém "dias" (ex.: KEIVILANNY DIAS MOURA GONÇALVES, nome TSE);
  // qualquer nome contendo "keiva"; primeiro com votos > 0; primeira opção.
  const pickMineDefault = (opts) =>
    opts.find((n) => normalize(n) === 'keiva dias') ||
    opts.find((n) => { const k = normalize(n); return k.startsWith('keiv') && k.includes('dias'); }) ||
    opts.find((n) => normalize(n).includes('keiva')) ||
    opts.find((n) => (votesByKey.get(normalize(n)) || 0) > 0) ||
    opts[0];

  // Padrão: "Meu candidato" = Keiva Dias (quando existir), "Adversário" =
  // primeira outra opção com votos > 0 (senão, primeira outra opção).
  useEffect(() => {
    if (!options.length) return;
    const mineDefault = pickMineDefault(options);
    setMine(mineDefault);
    setTheirs(
      options.find((n) => n !== mineDefault && (votesByKey.get(normalize(n)) || 0) > 0) ||
      options.find((n) => n !== mineDefault) ||
      ''
    );
  }, [options, votesByKey]);

  const result = useMemo(() => {
    if (!data || !mine || !theirs || normalize(mine) === normalize(theirs)) return null;
    const perCity = data.cities.map((city) => ({
      city: city.city,
      minePast: sumFor(city.past, mine),
      theirsPast: sumFor(city.past, theirs),
      mineCurrent: sumFor(city.current, mine),
      theirsCurrent: sumFor(city.current, theirs),
    }));
    return {
      perCity,
      minePastTotal: perCity.reduce((s, c) => s + c.minePast, 0),
      theirsPastTotal: perCity.reduce((s, c) => s + c.theirsPast, 0),
      mineCurrentTotal: perCity.reduce((s, c) => s + c.mineCurrent, 0),
      theirsCurrentTotal: perCity.reduce((s, c) => s + c.theirsCurrent, 0),
    };
  }, [data, mine, theirs]);

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
        title="Inteligência Eleitoral"
        subtitle={`${office} ${data?.pastYear || PAST_YEAR} — ${turnLabel[data?.turn ?? TURN] || `${data?.turn}º Turno`}`}
      />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <div className="empty">Carregando...</div>}

        {data && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="panel-title">Confronto Direto</h2>
              <div className="field">
                <label>Cargo (eleição {data?.pastYear || PAST_YEAR})</label>
                <select value={office} onChange={(e) => setOffice(e.target.value)}>
                  {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Meu candidato</label>
                <select value={mine} onChange={(e) => setMine(e.target.value)}>
                  {options.map((n) => <option key={normalize(n)} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Adversário</label>
                <select value={theirs} onChange={(e) => setTheirs(e.target.value)}>
                  {options.map((n) => <option key={normalize(n)} value={n}>{n}</option>)}
                </select>
                <div className="hint">Escolha dois candidatos diferentes para comparar.</div>
              </div>

              {!result && <div className="meta">Selecione candidatos diferentes para ver o confronto.</div>}
              {result && (
                <>
                  <h3 className="panel-title" style={{ fontSize: 15 }}>Votos TSE {data.pastYear} — {data.office}</h3>
                  <Totals mine={mine} theirs={theirs} mineTotal={result.minePastTotal} theirsTotal={result.theirsPastTotal} />

                  <h3 className="panel-title" style={{ fontSize: 15, marginTop: 20 }}>Intenção de Voto (cadastrados)</h3>
                  {result.mineCurrentTotal + result.theirsCurrentTotal === 0 ? (
                    <div className="meta">Nenhuma intenção de voto cadastrada para estes candidatos ainda.</div>
                  ) : (
                    <Totals mine={mine} theirs={theirs} mineTotal={result.mineCurrentTotal} theirsTotal={result.theirsCurrentTotal} />
                  )}
                </>
              )}
            </div>

            {result && (
              <div className="card">
                <h3 className="panel-title">Por Cidade</h3>
                {result.perCity.filter((c) => c.minePast + c.theirsPast + c.mineCurrent + c.theirsCurrent > 0).length === 0 && (
                  <div className="meta">Sem dados para os candidatos selecionados.</div>
                )}
                {result.perCity
                  .filter((c) => c.minePast + c.theirsPast + c.mineCurrent + c.theirsCurrent > 0)
                  .map((c) => {
                    const cityPct = pct(c.minePast, c.theirsPast);
                    return (
                      <div key={c.city} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{c.city}</span>
                          <span className="meta">{c.minePast.toLocaleString('pt-BR')} vs {c.theirsPast.toLocaleString('pt-BR')}</span>
                        </div>
                        <SplitBar minePct={cityPct} />
                        {(c.mineCurrent > 0 || c.theirsCurrent > 0) && (
                          <div className="meta">Intenção: {c.mineCurrent} vs {c.theirsCurrent}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
