import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, apiDownload, getUser } from '../lib/api';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: 'white',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};

const buttonStyle = (bg, color = 'white') => ({
  padding: '10px 14px',
  border: 0,
  borderRadius: 8,
  background: bg,
  color,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

function statusStyle(status) {
  if (status === 'OK') return { color: '#047857', background: '#ECFDF5' };
  if (status.startsWith('Faltam')) return { color: '#B45309', background: '#FFFBEB' };
  return { color: '#64748B', background: '#F1F5F9' };
}

function formatMissingPercentage(promised, missing) {
  if (promised === null || promised === undefined || missing === null || missing === undefined) return '—';
  const p = Number(promised) || 0;
  const m = Number(missing) || 0;
  if (!p) return '0,0%';
  return `${((m / p) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatCount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('pt-BR') : '—';
}

function matchesNumberFilter(value, filter) {
  const rawFilter = String(filter || '').trim();
  if (!rawFilter) return true;
  if (!/^\d+$/.test(rawFilter)) return false;
  return Number.parseInt(String(value ?? '').trim(), 10) === Number.parseInt(rawFilter, 10);
}

function clearAllFilters(setCaboId, setSubcaboId, setFiltroCidade, setFiltroZona, setFiltroSecao) {
  setCaboId('');
  setSubcaboId('');
  setFiltroCidade('');
  setFiltroZona('');
  setFiltroSecao('');
}

export default function Crossing() {
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoNome, setCandidatoNome] = useState('');
  const [cabos, setCabos] = useState([]);
  const [subcabos, setSubcabos] = useState([]);
  const [caboId, setCaboId] = useState('');
  const [subcaboId, setSubcaboId] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [filtroSecao, setFiltroSecao] = useState('');
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [missingVoters, setMissingVoters] = useState(null);
  const [missingVotersLoading, setMissingVotersLoading] = useState(false);
  const missingVotersRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const me = getUser();

  useEffect(() => {
    api('/candidates')
      .then((data) => setCandidatos(data.candidates || []))
      .catch(() => setCandidatos([]));

    if (me?.role === 'ADMIN') {
      api('/dashboard/list?type=cabos')
        .then((res) => setCabos(res.items || []))
        .catch(() => setCabos([]));
      api('/dashboard/list?type=subcabos')
        .then((res) => setSubcabos(res.items || []))
        .catch(() => setSubcabos([]));
    }
  }, [me?.role]);

  useEffect(() => {
    let mounted = true;
    if (!candidatoNome) {
      setRows([]);
      setReport(null);
      setMissingVoters(null);
      setError('');
      setLoading(false);
      return () => { mounted = false; };
    }

    setLoading(true);
    setError('');
    setReport(null);
    const candidateQuery = reportQuery();
    Promise.all([
      api(`/elections/comparativo-eleitores${candidateQuery}`),
      api(`/elections/relatorio-faltantes${candidateQuery}`),
    ])
      .then(([comparison, summary]) => {
        if (!mounted) return;
        setRows(comparison.rows || []);
        setReport(summary);
        setMissingVoters(null);
      })
      .catch(() => {
        if (mounted) {
          setRows([]);
          setReport(null);
          setError('Não foi possível carregar a comparação eleitoral.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [candidatoNome, caboId, subcaboId, filtroCidade, filtroZona, filtroSecao]);

  async function downloadReport() {
    try {
      await apiDownload(`/elections/relatorio-faltantes/pdf${reportQuery()}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Não foi possível gerar o PDF.');
    }
  }

  function reportQuery() {
    const queryParams = new URLSearchParams({ candidateName: candidatoNome });
    if (caboId) queryParams.set('caboId', caboId);
    if (subcaboId) queryParams.set('subcaboId', subcaboId);
    if (filtroCidade.trim()) queryParams.set('city', filtroCidade.trim());
    if (filtroZona.trim()) queryParams.set('zone', filtroZona.trim());
    if (filtroSecao.trim()) queryParams.set('section', filtroSecao.trim());
    return `?${queryParams.toString()}`;
  }

  async function showMissingVoters() {
    setMissingVotersLoading(true);
    try {
      const data = await api(`/elections/relatorio-faltantes/eleitores${reportQuery()}`);
      setMissingVoters(data.voters || []);
      window.setTimeout(() => {
        if (typeof missingVotersRef.current?.scrollIntoView === 'function') {
          missingVotersRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar os eleitores das seções faltantes.');
    } finally {
      setMissingVotersLoading(false);
    }
  }

  async function downloadMissingVotersReport() {
    try {
      await apiDownload(`/elections/relatorio-faltantes/eleitores/pdf${reportQuery()}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Não foi possível gerar o relatório de eleitores.');
    }
  }

  const filteredRows = useMemo(() => {
    const caboName = cabos.find((item) => String(item.id) === String(caboId))?.title || '';
    const subcaboName = subcabos.find((item) => String(item.id) === String(subcaboId))?.title || '';

    return rows.filter((row) => (
      (!caboName || row.cabo === caboName)
      && (!subcaboName || row.subcabo === subcaboName)
      && (!filtroCidade || String(row.city || '').toLocaleUpperCase('pt-BR').includes(filtroCidade.toLocaleUpperCase('pt-BR')))
      && matchesNumberFilter(row.zona, filtroZona)
      && matchesNumberFilter(row.secao, filtroSecao)
    ));
  }, [rows, cabos, subcabos, caboId, subcaboId, filtroCidade, filtroZona, filtroSecao]);

  const visibleSubcabos = useMemo(() => (
    caboId
      ? subcabos.filter((subcabo) => String(subcabo.caboId) === String(caboId))
      : subcabos
  ), [subcabos, caboId]);

  useEffect(() => {
    if (subcaboId && !visibleSubcabos.some((subcabo) => String(subcabo.id) === String(subcaboId))) {
      setSubcaboId('');
    }
  }, [subcaboId, visibleSubcabos]);

  const reportDetails = report?.details || report?.missing || [];

  return (
    <>
      <AppHeader title="Inteligência Eleitoral" subtitle="Auditoria de Urnas" />
      <div className="page comparison-page" style={{ paddingBottom: 104 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 6px', color: '#0F172A' }}>Comparativo por seção</h2>
          <p style={{ margin: 0, color: '#64748B' }}>
            Veja o que cada equipe cadastrou e compare com a apuração oficial do TSE.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
          {candidatos.map((candidato) => (
            <button
              key={candidato.id}
              type="button"
              onClick={() => setCandidatoNome(candidato.name)}
              style={{
                flex: '0 0 auto',
                padding: '12px 24px',
                background: candidatoNome === candidato.name ? '#2563EB' : '#E2E8F0',
                color: candidatoNome === candidato.name ? 'white' : '#1E293B',
                borderRadius: 8,
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {candidato.name}
            </button>
          ))}
        </div>

        {!candidatoNome ? (
          <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>
            Selecione uma candidata para ver a comparação.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={downloadReport} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#0F766E', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  Exportar relatório PDF
                </button>
                <button type="button" onClick={() => apiDownload(`/elections/inteligencia-eleitoral/eleitores/pdf${reportQuery()}`).catch((e) => setError(e.message || 'Não foi possível gerar o PDF detalhado.'))} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#2563EB', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  PDF possíveis não votantes (detalhado)
                </button>
                <button type="button" onClick={() => apiDownload(`/elections/inteligencia-eleitoral/resumo-cabos/pdf${reportQuery()}`).catch((e) => setError(e.message || 'Não foi possível gerar o resumo por cabo.'))} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#0F766E', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  PDF resumo por cabo
                </button>
                <button type="button" onClick={() => apiDownload(`/elections/inteligencia-eleitoral/cabos/pdf${reportQuery()}`).catch((e) => setError(e.message || 'Não foi possível gerar o ranking de cabos.'))} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#7C3AED', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  PDF ranking de cabos
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', background: '#F8FAFC', padding: 16, borderRadius: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <label htmlFor="filtro-cabo" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569' }}>Cabo</label>
                <select id="filtro-cabo" aria-label="Cabo" value={caboId} onChange={(event) => setCaboId(event.target.value)} style={selectStyle}>
                  <option value="">Todos</option>
                  {cabos.map((cabo) => <option key={cabo.id} value={cabo.id}>{cabo.title}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <label htmlFor="filtro-subcabo" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569' }}>Subcabo</label>
                <select id="filtro-subcabo" aria-label="Subcabo" value={subcaboId} onChange={(event) => setSubcaboId(event.target.value)} style={selectStyle}>
                  <option value="">Todos</option>
                  {visibleSubcabos.map((subcabo) => <option key={subcabo.id} value={subcabo.id}>{subcabo.title}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <label htmlFor="filtro-cidade" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569' }}>Cidade</label>
                <input id="filtro-cidade" aria-label="Cidade" type="text" placeholder="Ex: Fortaleza" value={filtroCidade} onChange={(event) => setFiltroCidade(event.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                <label htmlFor="filtro-zona" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569' }}>Zona</label>
                <input id="filtro-zona" aria-label="Zona" type="text" inputMode="numeric" placeholder="Ex: 120" value={filtroZona} onChange={(event) => setFiltroZona(event.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                <label htmlFor="filtro-secao" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569' }}>Seção</label>
                <input id="filtro-secao" aria-label="Seção" type="text" inputMode="numeric" placeholder="Ex: 0533" value={filtroSecao} onChange={(event) => setFiltroSecao(event.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: '0 1 140px', minWidth: 0 }}>
                <label htmlFor="limpar-filtros" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#475569', visibility: 'hidden' }}>Ações</label>
                <button id="limpar-filtros" type="button" onClick={() => clearAllFilters(setCaboId, setSubcaboId, setFiltroCidade, setFiltroZona, setFiltroSecao)} style={{ ...buttonStyle('#64748B'), width: '100%', minHeight: 42, padding: '10px 12px', fontSize: 13 }}>
                  Limpar filtros
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ order: 0 }}>
                {loading ? (
                  <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>Carregando comparação...</div>
                ) : error ? (
                  <div className="empty" style={{ textAlign: 'center', marginTop: 32, color: '#BE123C' }}>{error}</div>
                ) : filteredRows.length === 0 ? (
                  <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>Nenhum registro encontrado para os filtros atuais.</div>
                ) : (
                  <div className="comparison-table-card" style={{ background: '#fff', borderRadius: 8, padding: 16, overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#0F172A' }}>Cadastrados x apurado TSE</h3>
                    <span style={{ color: '#64748B', fontSize: 13 }}>{filteredRows.length} agrupamento(s) encontrado(s)</span>
                  </div>
                  <strong style={{ color: '#2563EB', whiteSpace: 'nowrap' }}>{candidatoNome}</strong>
                </div>
                <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                      {['Cabo', 'Subcabo', 'Cidade', 'Zona', 'Seção', 'Votos cadastrados', 'Apurado TSE', 'Status'].map((heading) => (
                        <th key={heading} scope="col" style={{ padding: '12px 8px', borderBottom: '2px solid #E2E8F0', color: '#475569', whiteSpace: 'nowrap' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const diff = Number(row.diferenca) || (Number(row.cadastrados) - Number(row.apurado));
                      const displayStatus = diff > 0 ? `Faltam ${formatCount(diff)} votos` : 'OK';
                      return (
                        <tr key={`${row.cabo}-${row.subcabo}-${row.zona}-${row.secao}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.cabo || '—'}</td>
                          <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{row.subcabo || '—'}</td>
                          <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{row.city || '—'}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.zona}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.secao}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right' }}>{formatCount(row.cadastrados)}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right' }}>{formatCount(row.apurado)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}><span style={{ ...statusStyle(displayStatus), display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{displayStatus}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                )}
              </div>

            {report && (
              <section className="report-section" style={{ order: -1, marginBottom: 24 }} aria-labelledby="missing-report-title">
                <div className="comparison-table-card" style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div>
                      <h3 id="missing-report-title" style={{ margin: 0, color: '#0F172A' }}>Relatório de votos faltantes</h3>
                      <p style={{ margin: '6px 0 0', color: '#64748B' }}>Entram aqui somente as diferenças positivas entre cadastrados e apurado TSE.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={showMissingVoters} disabled={missingVotersLoading} style={{ padding: '9px 12px', border: '1px solid #0F766E', borderRadius: 8, background: 'white', color: '#0F766E', fontWeight: 700, cursor: missingVotersLoading ? 'wait' : 'pointer' }}>
                        {missingVotersLoading ? 'Carregando...' : 'Ver nomes dos eleitores'}
                      </button>
                      <button type="button" onClick={downloadMissingVotersReport} style={{ padding: '9px 12px', border: 0, borderRadius: 8, background: '#0F766E', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                        PDF com nomes
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                      ['Prometidos', report.totalCadastrados],
                      ['Apurado TSE', report.totalApurado],
                      ['Confirmados', report.totalConfirmados],
                      ['Faltantes', report.totalFaltantes],
                    ].map(([label, value]) => (
                      <div key={label} style={{ minWidth: 0, padding: 14, borderRadius: 8, background: '#F8FAFC' }}>
                        <strong style={{ display: 'block', fontSize: 24, color: label === 'Faltantes' ? '#BE123C' : '#0F172A' }}>{formatCount(value)}</strong>
                        <span style={{ color: '#64748B', fontSize: 12 }}>{label}</span>
                        {label === 'Faltantes' && (
                          <span style={{ display: 'block', marginTop: 4, color: '#BE123C', fontSize: 12, fontWeight: 700 }}>
                            {formatMissingPercentage(report.totalCadastrados, report.totalFaltantes)} dos prometidos
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '-12px 0 20px', color: '#64748B', fontSize: 12 }}>
                    Faltantes = máximo(prometidos − apurado, 0); percentual = faltantes ÷ prometidos.
                  </p>

                  <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Resumo por cabo e subcabo</h4>
                  <p style={{ margin: '-4px 0 10px', color: '#64748B', fontSize: 12 }}>
                    As seções com falta são alertas compartilhados; os totais gerais contam cada seção uma única vez.
                  </p>
                  <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead><tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                        {['Cabo', 'Subcabo', 'Prometidos', 'Seções', 'Seções com faltantes'].map((heading) => <th key={heading} scope="col" style={{ padding: '10px 8px', borderBottom: '2px solid #E2E8F0', color: '#475569', whiteSpace: 'nowrap', textAlign: ['Prometidos', 'Seções', 'Seções com faltantes'].includes(heading) ? 'right' : 'left' }}>{heading}</th>)}
                      </tr></thead>
                      <tbody>{report.summary.map((row) => (
                        <tr key={`${row.cabo}-${row.subcabo}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.cabo || '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{row.subcabo || '—'}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 700, fontSize: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCount(row.cadastrados)}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 600, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCount(row.secoes)}</td>
                          <td style={{ padding: '10px 8px', color: row.secoesComFaltantes ? '#BE123C' : '#047857', fontWeight: 700, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCount(row.secoesComFaltantes)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>

                  <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Detalhamento por zona e seção</h4>
                  {reportDetails.length === 0 ? (
                    <div style={{ padding: 14, color: '#047857', background: '#ECFDF5', borderRadius: 8 }}>Nenhum cadastro encontrado.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead><tr style={{ background: '#FFF7ED', textAlign: 'left' }}>
                          {['Equipes associadas', 'Cidade', 'Zona', 'Seção', 'Prometidos', 'Apurado TSE', 'Confirmados', 'Faltantes', '% faltantes', 'Status'].map((heading) => <th key={heading} scope="col" style={{ padding: '10px 8px', borderBottom: '2px solid #FED7AA', color: '#9A3412', whiteSpace: 'nowrap', textAlign: ['Prometidos', 'Apurado TSE', 'Confirmados', 'Faltantes', '% faltantes'].includes(heading) ? 'right' : ['Zona', 'Seção', 'Status'].includes(heading) ? 'center' : 'left' }}>{heading}</th>)}
                        </tr></thead>
                        <tbody>{reportDetails.map((row) => (
                          <tr key={`${row.city || ''}-${row.zona}-${row.secao}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 600, maxWidth: 260, overflowWrap: 'anywhere' }}>{row.teams?.map((team) => [team.cabo, team.subcabo].filter(Boolean).join(' / ') || 'Cadastro direto').join(', ') || [row.cabo, row.subcabo].filter(Boolean).join(' / ') || '—'}</td>
                            <td style={{ padding: '10px 8px' }}>{row.city || '—'}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>{row.zona}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>{row.secao}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCount(row.cadastrados)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCount(row.apurado)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCount(row.confirmados)}</td>
                            <td style={{ padding: '10px 8px', color: row.faltantes ? '#BE123C' : '#047857', fontWeight: 700, textAlign: 'right' }}>{formatCount(row.faltantes)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMissingPercentage(row.cadastrados, row.faltantes)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{ ...statusStyle(row.apurado > row.cadastrados ? 'OK' : row.faltantes > 0 ? 'Faltam votos' : 'OK'), display: 'inline-block', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {row.apurado > row.cadastrados ? 'OK' : row.faltantes > 0 ? `Faltam ${formatCount(row.faltantes)} votos` : 'OK'}
                              </span>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}

                  {missingVoters && (
                    <div ref={missingVotersRef} style={{ marginTop: 24, scrollMarginTop: 20 }}>
                      <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Eleitores cadastrados nas seções abaixo da meta ({missingVoters.length})</h4>
                      <p style={{ margin: '0 0 10px', color: '#64748B', fontSize: 12 }}>A diferença é da seção; os dados disponíveis não identificam individualmente quem compareceu.</p>
                      {missingVoters.length === 0 ? (
                        <div style={{ padding: 14, color: '#047857', background: '#ECFDF5', borderRadius: 8 }}>Nenhum eleitor encontrado nas seções faltantes.</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead><tr style={{ background: '#EFF6FF', textAlign: 'left' }}>
                              {['Nome', 'Telefone', 'Cidade', 'Bairro', 'Cabo', 'Subcabo', 'Zona', 'Seção', 'Situação da seção'].map((heading) => <th key={heading} scope="col" style={{ padding: '10px 8px', borderBottom: '2px solid #BFDBFE', color: '#1D4ED8', whiteSpace: 'nowrap' }}>{heading}</th>)}
                            </tr></thead>
                            <tbody>{missingVoters.map((voter) => (
                              <tr key={`${voter.name}-${voter.phone}-${voter.zona}-${voter.secao}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '10px 8px', fontWeight: 600, maxWidth: 240, overflowWrap: 'anywhere' }}>{voter.name || '—'}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{voter.phone}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{voter.city || '—'}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{voter.neighborhood || '—'}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{voter.cabo || '—'}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{voter.subcabo || '—'}</td>
                                <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{voter.zona}</td>
                                <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{voter.secao}</td>
                                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Seção abaixo da meta</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
