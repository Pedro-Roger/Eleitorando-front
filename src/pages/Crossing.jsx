import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api } from '../lib/api';

export default function Crossing() {
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoNome, setCandidatoNome] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/candidates').then(data => {
      setCandidatos(data.candidates || []);
    }).catch(() => setCandidatos([]));
  }, []);

  useEffect(() => {
    if (!candidatoNome) {
      setData(null);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    
    api(`/elections/comparativo-zona?candidateName=${encodeURIComponent(candidatoNome)}&limit=9999`)
      .then((res) => {
        if (isMounted) {
          const sections = res.sections || [];
          
          const byCity = {};
          
          sections.forEach(item => {
            const cityName = item.city || 'Desconhecida';
            if (!byCity[cityName]) {
              byCity[cityName] = {};
            }
            
            const zona = item.zona || '?';
            if (!byCity[cityName][zona]) {
              byCity[cityName][zona] = { tse: 0, coletado: 0 };
            }
            
            byCity[cityName][zona].tse += (Number(item.tse) || 0);
            byCity[cityName][zona].coletado += (Number(item.coletado) || 0);
          });
          
          setData(byCity);
        }
      })
      .catch(() => {
        if (isMounted) setData({});
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
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 8 }}>
          {candidatos.map(c => (
            <button 
              key={c.id} 
              onClick={() => setCandidatoNome(c.name)}
              style={{ 
                flex: '0 0 auto', 
                padding: '12px 24px', 
                background: candidatoNome === c.name ? '#2563EB' : '#E2E8F0',
                color: candidatoNome === c.name ? 'white' : '#1E293B',
                borderRadius: 8,
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {candidatoNome && (
          <h2 className="panel-title" style={{ marginBottom: 16 }}>Comparativo de Votos por Cidade e Zona</h2>
        )}
        
        {!candidatoNome ? (
          <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>
            Selecione uma candidata acima.
          </div>
        ) : loading ? (
          <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>
            Carregando dados...
          </div>
        ) : !data || Object.keys(data).length === 0 ? (
          <div className="empty" style={{ textAlign: 'center', marginTop: 32 }}>
            Nenhum dado encontrado para {candidatoNome}.
          </div>
        ) : (
          Object.keys(data).sort().map(cidade => (
            <div key={cidade} style={{ marginBottom: 24, background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ background: '#F8FAFC', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A' }}>{cidade}</h3>
              </div>
              
              <div style={{ padding: 16 }}>
                {Object.keys(data[cidade]).sort((a,b) => Number(a) - Number(b)).map(zona => {
                  const item = data[cidade][zona];
                  const color = item.coletado >= item.tse && item.tse > 0 ? '#10B981' : '#64748B';
                  
                  return (
                    <div key={zona} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F1F5F9', borderLeft: \`4px solid \${color}\`, paddingLeft: 12 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Zona {zona}</h4>
                      <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: 12 }}>Sistema (Eleitorando)</span>
                          <strong style={{ fontSize: 18, color: '#0F172A' }}>{item.coletado}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: 12 }}>Oficial (TSE)</span>
                          <strong style={{ fontSize: 18, color: '#0F172A' }}>{item.tse}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
