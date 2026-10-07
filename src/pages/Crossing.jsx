import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, getUser } from '../lib/api';

export default function Crossing() {
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoNome, setCandidatoNome] = useState('');
  
  const [cabos, setCabos] = useState([]);
  const [subcabos, setSubcabos] = useState([]);
  const [caboId, setCaboId] = useState('');
  const [subcaboId, setSubcaboId] = useState('');

  const [data, setData] = useState(null);
  const [totais, setTotais] = useState({ tse: 0, coletado: 0 });
  const [loading, setLoading] = useState(false);
  const me = getUser();

  useEffect(() => {
    api('/candidates').then(data => {
      setCandidatos(data.candidates || []);
    }).catch(() => setCandidatos([]));

    if (me?.role === 'ADMIN') {
      api('/dashboard/list?type=cabos').then(res => setCabos(res.items || [])).catch(console.error);
      api('/dashboard/list?type=subcabos').then(res => setSubcabos(res.items || [])).catch(console.error);
    }
  }, [me]);

  useEffect(() => {
    if (!candidatoNome) {
      setData(null);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    
    let url = `/elections/comparativo-zona?candidateName=${encodeURIComponent(candidatoNome)}&limit=9999`;
    if (caboId) url += `&caboId=${caboId}`;
    if (subcaboId) url += `&subcaboId=${subcaboId}`;
    
    api(url)
      .then((res) => {
        if (isMounted) {
          const sections = res.sections || [];
          setTotais({ tse: res.totalTseVotes || 0, coletado: res.totalCollectedVoters || 0 });
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
        if (isMounted) { setData({}); setTotais({ tse: 0, coletado: 0 }); }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [candidatoNome, caboId, subcaboId]);

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
          <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Cabo Eleitoral</label>
              <select 
                value={caboId} 
                onChange={e => { setCaboId(e.target.value); setSubcaboId(''); }} 
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              >
                <option value="">Todos</option>
                {cabos.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>Subcabo</label>
              <select 
                value={subcaboId} 
                onChange={e => { setSubcaboId(e.target.value); setCaboId(''); }} 
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              >
                <option value="">Todos</option>
                {subcabos.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>
        )}

        
        {candidatoNome && data && Object.keys(data).length > 0 && (
          <div style={{ background: '#0F172A', color: 'white', padding: 20, borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 14, color: '#94A3B8', marginBottom: 4 }}>Total Sistema (Eleitorando)</span>
              <strong style={{ fontSize: 28, color: '#10B981' }}>{totais.coletado}</strong>
            </div>
            <div style={{ width: 1, height: 40, background: '#334155' }}></div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 14, color: '#94A3B8', marginBottom: 4 }}>Total Oficial (TSE)</span>
              <strong style={{ fontSize: 28, color: '#38BDF8' }}>{totais.tse}</strong>
            </div>
          </div>
        )}

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
