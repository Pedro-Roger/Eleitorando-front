import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api } from '../lib/api';

export default function Crossing() {
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoNome, setCandidatoNome] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/candidates').then(data => setCandidatos(data.candidates || [])).catch(() => setCandidatos([]));
  }, []);

  useEffect(() => {
    if (!candidatoNome) {
      setData(null);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    
    api(`/elections/comparativo-zona?candidateName=${encodeURIComponent(candidatoNome)}`)
      .then((res) => {
        if (isMounted) setData(res.sections || []);
      })
      .catch(() => {
        if (isMounted) setData([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [candidatoNome]);

  return (
    <>
      <AppHeader title="Inteligência Eleitoral" subtitle="Auditoria de Urnas" />
      <div className="page" style={{ paddingBottom: 104 }}>
        
        <div style={{ marginBottom: 16 }}>
          <select 
            value={candidatoNome} 
            onChange={e => setCandidatoNome(e.target.value)} 
            style={{ padding: 8, width: '100%', borderRadius: 8 }}
          >
            <option value="">Selecione o Candidato</option>
            {candidatos.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {candidatoNome && (
          <h2 className="panel-title" style={{ marginBottom: 16 }}>Votos Coletados vs TSE</h2>
        )}
        
        {!candidatoNome ? (
          <div className="empty">Selecione um candidato para ver os dados.</div>
        ) : loading ? (
          <div className="empty">Carregando auditoria...</div>
        ) : !data || data.length === 0 ? (
          <div className="empty">Nenhum dado encontrado.</div>
        ) : (
          data.map(zona => {
            const divergencia = Math.abs((zona.coletado || 0) - (zona.tse || 0));
            const statusColor = divergencia === 0 ? '#10B981' : '#E11D48';
            
            return (
              <div key={`${zona.zona}-${zona.secao}`} className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${statusColor}` }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>
                  Zona {zona.zona} — Seção {zona.secao}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Coletado (Voter):</span>
                  <strong>{zona.coletado || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Apurado (TSE):</span>
                  <strong>{zona.tse || 0}</strong>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E2E8F0', color: statusColor, fontWeight: 'bold' }}>
                  {divergencia === 0 ? '✓ 100% Batido' : `⚠️ Divergência: ${divergencia} votos`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}