import React, { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, getUser } from '../lib/api';

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
      setError('');
      setLoading(false);
      return () => { mounted = false; };
    }

    setLoading(true);
    setError('');
    api(`/elections/comparativo-eleitores?candidateName=${encodeURIComponent(candidatoNome)}`)
      .then((res) => {
        if (mounted) setRows(res.rows || []);
      })
      .catch(() => {
        if (mounted) {
          setRows([]);
          setError('Não foi possível carregar a comparação eleitoral.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [candidatoNome]);

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
          </>
        )}
      </div>
    </>
  );
}
