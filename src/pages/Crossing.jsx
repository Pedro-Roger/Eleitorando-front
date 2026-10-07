import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { api, getUser } from '../lib/api';

// Inteligência Eleitoral — comparativo "previsto vs realizado" entre DOIS
// políticos (slots A e B, cargos podem ser diferentes). Obtido = apurado
// oficial do TSE 2026; Coletado = eleitores cadastrados na campanha atribuídos
// ao político. Inclui delta de votos entre os slots e a base por bairro.
const PAST_YEAR = 2026;
const TURN = 1;
// Cargos presentes na base TSE (fallback quando /elections/offices falha).
// DEPUTADO ESTADUAL primeiro: é onde corre a candidata principal (Keiva Dias).
const DEFAULT_OFFICES = ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'];
const DEFAULT_OFFICE = DEFAULT_OFFICES[0];
const COLORS = { bairros: '#3B82F6' };

// Compara nomes ignorando acentos, caixa e espaços extras.
function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Opções do seletor = união dos candidatos cadastrados (grafia preferida) e
// dos nomes statewide da base TSE, dedupe por nome normalizado.
function optionsFor(entry) {
  const byKey = new Map();
  for (const c of entry.registered || []) byKey.set(normalize(c.name), c.name);
  for (const c of entry.tse || []) {
    const key = normalize(c.candidateName);
    if (key && !byKey.has(key)) byKey.set(key, c.candidateName);
  }
  return [...byKey.values()];
}

// Votos apurados oficiais (TSE, statewide) por nome normalizado.
function votesByKeyFor(entry) {
  const byKey = new Map();
  for (const c of entry.tse || []) {
    const key = normalize(c.candidateName);
    byKey.set(key, (byKey.get(key) || 0) + (c.votes || 0));
  }
  return byKey;
}

// Coletado (base da campanha): soma dos eleitores cadastrados do político em
// todas as cidades do comparativo (lado current, agregado client-side).
function coletadoFor(entry, name) {
  const key = normalize(name);
  return (entry.cities || []).reduce(
    (sum, city) => sum + (city.current || []).reduce(
      (s, c) => (normalize(c.name) === key ? s + (c.voters ?? 0) : s),
      0
    ),
    0
  );
}

// Padrão do slot A (em ordem): nome exato "keiva dias"; começa com "keiv" e
// contém "dias" (ex.: KEIVILANNY DIAS MOURA GONÇALVES, nome TSE); qualquer
// nome contendo "keiva"; primeiro com votos > 0; primeira opção.
function pickDefaultA(opts, votesByKey) {
  return (
    opts.find((n) => normalize(n) === 'keiva dias') ||
    opts.find((n) => { const k = normalize(n); return k.startsWith('keiv') && k.includes('dias'); }) ||
    opts.find((n) => normalize(n).includes('keiva')) ||
    opts.find((n) => (votesByKey.get(normalize(n)) || 0) > 0) ||
    opts[0]
  );
}

// Padrão do slot B: o OUTRO político com mais votos apurados no cargo
// (evita comparar o político consigo mesmo).
function pickDefaultB(opts, votesByKey, exclude) {
  const ex = normalize(exclude || '');
  return (
    opts
      .filter((n) => normalize(n) !== ex)
      .sort((a, b) => (votesByKey.get(normalize(b)) || 0) - (votesByKey.get(normalize(a)) || 0))[0] ||
    opts[0]
  );
}

// Barra horizontal proporcional ao máximo da série, com o valor absoluto à direita.
function Bar({ label, value, max, color }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span className="meta" style={{ width: 96 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F1F5F9' }}>
        <div style={{ width: `${width}%`, height: 8, borderRadius: 4, background: color }} />
      </div>
      <span className="meta" style={{ width: 72, textAlign: 'right' }}>{value.toLocaleString('pt-BR')}</span>
    </div>
  );
}

// Badge de meta do político: Previsto (coletado — eleitores cadastrados) vs
// Realizado (obtido — apurado TSE 2026 do próprio político).
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

// Delta de votos entre os dois slots: "X tem N votos a mais que Y (+P%)".
// P = N / total do perdedor (o menor dos dois); perdedor com 0 votos → "—".
function DeltaSummary({ nameA, nameB, a, b }) {
  if (a === 0 && b === 0) {
    return <div className="meta" style={{ marginTop: 12 }}>Sem votos apurados para comparar.</div>;
  }
  if (a === b) {
    return <div className="meta" style={{ marginTop: 12 }}>Empate — {a.toLocaleString('pt-BR')} votos para cada.</div>;
  }
  const winner = a > b ? nameA : nameB;
  const loser = a > b ? nameB : nameA;
  const n = Math.abs(a - b);
  const pct = a > b ? b : a; // base do percentual = total do perdedor (o menor)
  return (
    <div style={{
      marginTop: 12, padding: 10, borderRadius: 6,
      background: '#FEF9C3', border: '1px solid #FDE68A', color: '#854D0E', fontWeight: 'bold',
    }}>
      {winner} tem {n.toLocaleString('pt-BR')} votos a mais que {loser}
      {pct > 0 ? ` (+${(Math.round((n / pct) * 1000) / 10).toLocaleString('pt-BR')}%)` : ' (+—%)'}
    </div>
  );
}

// Card "Obtido vs Coletado" de um slot: apurado oficial TSE vs base da campanha.
function ObtidoColetadoCard({ slot, politico, obtido, coletado }) {
  return (
    <div className="card" data-testid={`obtido-coletado-${slot.toLowerCase()}`} style={{ marginBottom: 16 }}>
      <h3 className="panel-title">Obtido vs Coletado — {politico}</h3>
      <MetaBadge previsto={coletado} realizado={obtido} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
        <div>
          <div className="meta">Obtido</div>
          <strong style={{ fontSize: 24 }}>{obtido.toLocaleString('pt-BR')}</strong>
          <div className="meta">apurado oficial TSE {PAST_YEAR}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="meta">Coletado</div>
          <strong style={{ fontSize: 24 }}>{coletado.toLocaleString('pt-BR')}</strong>
          <div className="meta">base da campanha (eleitores cadastrados)</div>
        </div>
      </div>
    </div>
  );
}

// Card "Eleitores por bairro" de um slot: base cadastrada do político
// (GET /elections/base-bairros por candidateId da linha cadastrada).
function BairrosCard({ slot, politico, registered }) {
  const candidate = useMemo(
    () => (registered || []).find((c) => normalize(c.name) === normalize(politico)) || null,
    [registered, politico]
  );
  const [bairros, setBairros] = useState(null);

  useEffect(() => {
    if (!candidate) { setBairros(null); return; }
    let alive = true;
    setBairros(null);
    api(`/elections/base-bairros?candidateId=${candidate.id}`)
      .then((r) => { if (alive) setBairros(r.bairros || []); })
      .catch(() => { if (alive) setBairros([]); });
    return () => { alive = false; };
  }, [candidate]);

  const max = bairros ? Math.max(...bairros.map((x) => x.total)) : 0;

  return (
    <div className="card" data-testid={`bairros-${slot.toLowerCase()}`} style={{ marginBottom: 16 }}>
      <h3 className="panel-title">Bairros — {politico}</h3>
      {!candidate && <div className="meta">Sem base cadastrada para este político.</div>}
      {candidate && !bairros && <div className="meta">Carregando...</div>}
      {candidate && bairros && bairros.length === 0 && (
        <div className="meta">Nenhum eleitor com bairro cadastrado.</div>
      )}
      {candidate && bairros && bairros.map((x) => (
        <Bar key={x.neighborhood} label={x.neighborhood} value={x.total} max={max} color={COLORS.bairros} />
      ))}
    </div>
  );
}

export default function Crossing() {
  const me = getUser();
  const isAdmin = me?.role === 'ADMIN';
  const [offices, setOffices] = useState(DEFAULT_OFFICES);
  const [slotA, setSlotA] = useState({ office: DEFAULT_OFFICE, politico: '' });
  const [slotB, setSlotB] = useState({ office: DEFAULT_OFFICE, politico: '' });
  // Cache por cargo: { [office]: { cities, registered, tse } } — cada cargo é
  // buscado uma vez, mesmo compartilhado entre os dois slots.
  const [cache, setCache] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    // Cargos reais da base TSE; em caso de falha, mantém o fallback padrão.
    api('/elections/offices')
      .then((r) => { if (Array.isArray(r.offices) && r.offices.length) setOffices(r.offices); })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const needed = [...new Set([slotA.office, slotB.office])].filter((o) => !cache[o]);
    if (!needed.length) return;
    let alive = true;
    Promise.all(needed.map((office) =>
      Promise.all([
        // limit=999: CE tem ~184 municípios — mostra todas as cidades
        api(`/elections/comparativo?pastYear=${PAST_YEAR}&office=${encodeURIComponent(office)}&turn=${TURN}&limit=999`),
        api('/candidates'),
        // Refetched junto com o comparativo: candidatos statewide do cargo/ano
        api(`/elections/candidates?year=${PAST_YEAR}&office=${encodeURIComponent(office)}&turn=${TURN}`),
      ]).then(([comp, cand, tse]) => [office, {
        cities: comp.cities || [],
        registered: cand.candidates || [],
        tse: tse.candidates || [],
      }])
    ))
      .then((pairs) => { if (alive) setCache((prev) => ({ ...prev, ...Object.fromEntries(pairs) })); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [isAdmin, slotA.office, slotB.office]);

  const entryA = cache[slotA.office];
  const entryB = cache[slotB.office];
  const optsA = useMemo(() => (entryA ? optionsFor(entryA) : []), [entryA]);
  const optsB = useMemo(() => (entryB ? optionsFor(entryB) : []), [entryB]);
  const votesA = useMemo(() => (entryA ? votesByKeyFor(entryA) : new Map()), [entryA]);
  const votesB = useMemo(() => (entryB ? votesByKeyFor(entryB) : new Map()), [entryB]);

  // Padrão do slot A: cascata Keiva.
  useEffect(() => {
    if (!optsA.length || slotA.politico) return;
    setSlotA((s) => (s.politico ? s : { ...s, politico: pickDefaultA(optsA, votesA) }));
  }, [optsA, votesA, slotA.politico]);

  // Padrão do slot B: outro político com mais votos no cargo do slot B.
  useEffect(() => {
    if (!optsB.length || slotB.politico || !slotA.politico) return;
    setSlotB((s) => (s.politico ? s : { ...s, politico: pickDefaultB(optsB, votesB, slotA.politico) }));
  }, [optsB, votesB, slotB.politico, slotA.politico]);

  // Troca de cargo reseta a escolha: dados são recarregados e um novo padrão
  // é escolhido para o slot (cargo novo = lista nova de políticos).
  const setOfficeA = (office) => setSlotA((s) => ({ office, politico: '' }));
  const setOfficeB = (office) => setSlotB((s) => ({ office, politico: '' }));

  const obtidoA = slotA.politico ? (votesA.get(normalize(slotA.politico)) || 0) : 0;
  const obtidoB = slotB.politico ? (votesB.get(normalize(slotB.politico)) || 0) : 0;
  const coletadoA = entryA && slotA.politico ? coletadoFor(entryA, slotA.politico) : 0;
  const coletadoB = entryB && slotB.politico ? coletadoFor(entryB, slotB.politico) : 0;

  if (!isAdmin) {
    return (
      <>
        <AppHeader title="Inteligência Eleitoral" subtitle="TSE 2026 — comparativo" />
        <div className="page"><div className="alert error">Acesso restrito ao administrador.</div></div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Inteligência Eleitoral" subtitle="TSE 2026 — comparativo" />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {(!entryA || !entryB) && !error && <div className="empty">Carregando...</div>}

        {entryA && entryB && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="panel-title">Comparativo</h2>

              <div className="field" data-testid="slot-a">
                <label>Cargo — A</label>
                <select value={slotA.office} onChange={(e) => setOfficeA(e.target.value)}>
                  {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <label>Político — A</label>
                <select value={slotA.politico} onChange={(e) => setSlotA({ ...slotA, politico: e.target.value })}>
                  {optsA.map((n) => <option key={normalize(n)} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="field" data-testid="slot-b">
                <label>Cargo — B</label>
                <select value={slotB.office} onChange={(e) => setOfficeB(e.target.value)}>
                  {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <label>Político — B</label>
                <select value={slotB.politico} onChange={(e) => setSlotB({ ...slotB, politico: e.target.value })}>
                  {optsB.map((n) => <option key={normalize(n)} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Delta: votos apurados oficiais (TSE) lado a lado */}
              <div data-testid="totais" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
                <div>
                  <div className="meta">A — {slotA.politico || '—'}</div>
                  <strong style={{ fontSize: 24 }}>{obtidoA.toLocaleString('pt-BR')}</strong>
                  <div className="meta">votos apurados TSE {PAST_YEAR}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="meta">B — {slotB.politico || '—'}</div>
                  <strong style={{ fontSize: 24 }}>{obtidoB.toLocaleString('pt-BR')}</strong>
                  <div className="meta">votos apurados TSE {PAST_YEAR}</div>
                </div>
              </div>
              <div data-testid="delta">
                <DeltaSummary nameA={slotA.politico} nameB={slotB.politico} a={obtidoA} b={obtidoB} />
              </div>
            </div>

            {slotA.politico && (
              <ObtidoColetadoCard slot="A" politico={slotA.politico} obtido={obtidoA} coletado={coletadoA} />
            )}
            {slotB.politico && (
              <ObtidoColetadoCard slot="B" politico={slotB.politico} obtido={obtidoB} coletado={coletadoB} />
            )}

            {slotA.politico && (
              <BairrosCard slot="A" politico={slotA.politico} registered={entryA.registered} />
            )}
            {slotB.politico && (
              <BairrosCard slot="B" politico={slotB.politico} registered={entryB.registered} />
            )}
          </>
        )}
      </div>
    </>
  );
}