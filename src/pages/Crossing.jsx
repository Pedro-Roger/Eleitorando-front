import React, { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, apiDownload, getUser } from '../lib/api';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: 'white',
};

function statusStyle(status) {
  if (status === 'OK') return { color: '#047857', background: '#ECFDF5' };
  if (status.startsWith('Faltam')) return { color: '#B45309', background: '#FFFBEB' };
  return { color: '#BE123C', background: '#FFF1F2' };
}

export default function Crossing() {
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoNome, setCandidatoNome] = useState('');
  const [cabos, setCabos] = useState([]);
  const [subcabos, setSubcabos] = useState([]);
  const [caboId, setCaboId] = useState('');
  const [subcaboId, setSubcaboId] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [filtroSecao, setFiltroSecao] = useState('');
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
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
      setError('');
      setLoading(false);
      return () => { mounted = false; };
    }

    setLoading(true);
    setError('');
    const query = new URLSearchParams({ candidateName: candidatoNome });
    if (caboId) query.set('caboId', caboId);
    if (subcaboId) query.set('subcaboId', subcaboId);
    const candidateQuery = `?${query.toString()}`;
    Promise.all([
      api(`/elections/comparativo-eleitores${candidateQuery}`),
      api(`/elections/relatorio-faltantes${candidateQuery}`),
    ])
      .then(([comparison, summary]) => {
        if (!mounted) return;
        setRows(comparison.rows || []);
        setReport(summary);
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
  }, [candidatoNome, caboId, subcaboId]);

  async function downloadReport() {
    try {
      const queryParams = new URLSearchParams({ candidateName: candidatoNome });
      if (caboId) queryParams.set('caboId', caboId);
      if (subcaboId) queryParams.set('subcaboId', subcaboId);
      const query = `?${queryParams.toString()}`;
      await apiDownload(`/elections/relatorio-faltantes/pdf${query}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Não foi possível gerar o PDF.');
    }
  }

  const filteredRows = useMemo(() => {
    const caboName = cabos.find((item) => String(item.id) === String(caboId))?.title || '';
    const subcaboName = subcabos.find((item) => String(item.id) === String(subcaboId))?.title || '';

    return rows.filter((row) => (
      (!caboName || row.cabo === caboName)
      && (!subcaboName || row.subcabo === subcaboName)
      && (!filtroZona || String(row.zona).includes(filtroZona))
      && (!filtroSecao || String(row.secao).includes(filtroSecao))
    ));
  }, [rows, cabos, subcabos, caboId, subcaboId, filtroZona, filtroSecao]);

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
              <button type="button" onClick={downloadReport} style={{ padding: '10px 14px', border: 0, borderRadius: 8, background: '#0F766E', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                Exportar relatório PDF
              </button>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', background: '#F8FAFC', padding: 16, borderRadius: 8 }}>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="filtro-cabo" style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Cabo</label>
                <select id="filtro-cabo" aria-label="Cabo" value={caboId} onChange={(event) => setCaboId(event.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {cabos.map((cabo) => <option key={cabo.id} value={cabo.id}>{cabo.title}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="filtro-subcabo" style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Subcabo</label>
                <select id="filtro-subcabo" aria-label="Subcabo" value={subcaboId} onChange={(event) => setSubcaboId(event.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  {visibleSubcabos.map((subcabo) => <option key={subcabo.id} value={subcabo.id}>{subcabo.title}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="filtro-zona" style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Zona</label>
                <input id="filtro-zona" aria-label="Zona" type="text" placeholder="Ex: 120" value={filtroZona} onChange={(event) => setFiltroZona(event.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="filtro-secao" style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Seção</label>
                <input id="filtro-secao" aria-label="Seção" type="text" placeholder="Ex: 0533" value={filtroSecao} onChange={(event) => setFiltroSecao(event.target.value)} style={inputStyle} />
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
                      {['Cabo', 'Subcabo', 'Zona', 'Seção', 'Votos cadastrados', 'Apurado TSE', 'Status'].map((heading) => (
                        <th key={heading} scope="col" style={{ padding: '12px 8px', borderBottom: '2px solid #E2E8F0', color: '#475569', whiteSpace: 'nowrap' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={`${row.cabo}-${row.subcabo}-${row.zona}-${row.secao}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{row.cabo || '—'}</td>
                        <td style={{ padding: '12px 8px' }}>{row.subcabo || '—'}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{row.zona}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{row.secao}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>{row.cadastrados}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>{row.apurado}</td>
                        <td style={{ padding: '12px 8px' }}><span style={{ ...statusStyle(row.status), display: 'inline-block', padding: '4px 8px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                )}
              </div>

            {report && (
              <section className="report-section" style={{ order: -1, marginBottom: 24 }} aria-labelledby="missing-report-title">
                <div className="comparison-table-card" style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ marginBottom: 20 }}>
                    <div>
                      <h3 id="missing-report-title" style={{ margin: 0, color: '#0F172A' }}>Relatório de votos faltantes</h3>
                      <p style={{ margin: '6px 0 0', color: '#64748B' }}>Entram aqui somente as diferenças positivas entre cadastrados e apurado TSE.</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                      ['Cadastrados', report.totalCadastrados],
                      ['Apurado nas seções com falta', report.totalApurado],
                      ['Total faltante', report.totalFaltantes],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: 14, borderRadius: 8, background: '#F8FAFC' }}>
                        <strong style={{ display: 'block', fontSize: 24, color: label === 'Total faltante' ? '#BE123C' : '#0F172A' }}>{value}</strong>
                        <span style={{ color: '#64748B', fontSize: 12 }}>{label}</span>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Resumo por cabo e subcabo</h4>
                  <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead><tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                        {['Cabo', 'Subcabo', 'Votos cadastrados', 'Seções'].map((heading) => <th key={heading} scope="col" style={{ padding: '10px 8px', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>{heading}</th>)}
                      </tr></thead>
                      <tbody>{report.summary.map((row) => (
                        <tr key={`${row.cabo}-${row.subcabo}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.cabo || '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{row.subcabo || '—'}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 700 }}>{row.cadastrados}</td>
                          <td style={{ padding: '10px 8px' }}>{row.secoes}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>

                  <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Zonas e seções com votos faltantes</h4>
                  {report.missing.length === 0 ? (
                    <div style={{ padding: 14, color: '#047857', background: '#ECFDF5', borderRadius: 8 }}>Nenhum voto faltante encontrado.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead><tr style={{ background: '#FFF7ED', textAlign: 'left' }}>
                          {['Zona', 'Seção', 'Cadastrados', 'Apurado TSE', 'Votos faltantes'].map((heading) => <th key={heading} scope="col" style={{ padding: '10px 8px', borderBottom: '2px solid #FED7AA', color: '#9A3412' }}>{heading}</th>)}
                        </tr></thead>
                        <tbody>{report.missing.map((row) => (
                          <tr key={`${row.zona}-${row.secao}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.zona}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.secao}</td>
                            <td style={{ padding: '10px 8px' }}>{row.cadastrados}</td>
                            <td style={{ padding: '10px 8px' }}>{row.apurado}</td>
                            <td style={{ padding: '10px 8px', color: '#BE123C', fontWeight: 800 }}>{row.faltantes}</td>
                          </tr>
                        ))}</tbody>
                      </table>
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
