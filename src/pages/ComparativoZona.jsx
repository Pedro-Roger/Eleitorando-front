import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api } from '../lib/api';

export default function ComparativoZona() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/elections/comparativo-zona')
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AppHeader title="Comparativo Zona/Seção" subtitle="Auditoria de Urnas" />
      <div className="page" style={{ paddingBottom: 104 }}>
        <h2 className="panel-title" style={{ marginBottom: 16 }}>Votos Coletados vs TSE</h2>
        
        {loading ? (
          <div className="empty">Carregando auditoria...</div>
        ) : data.length === 0 ? (
          <div className="empty">Nenhum dado encontrado.</div>
        ) : (
          data.map(zona => {
            const divergencia = Math.abs(zona.coletado - zona.tse);
            const statusColor = divergencia === 0 ? '#10B981' : '#E11D48';
            
            return (
              <div key={`${zona.zona}-${zona.secao}`} className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${statusColor}` }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>
                  Zona {zona.zona} — Seção {zona.secao}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Coletado (Voter):</span>
                  <strong>{zona.coletado}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Apurado (TSE):</span>
                  <strong>{zona.tse}</strong>
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
