import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { api } from '../lib/api';

export default function Crossing() {
  const [data, setData] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [adversario, setAdversario] = useState('');

  useEffect(() => {
    api('/candidatos').then(setCandidatos).catch(() => setCandidatos([]));
  }, []);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        const url = adversario ? `/elections/comparativo?adv=${adversario}` : '/elections/comparativo';
        const result = await api(url);
        setData(result);
      } catch (e) {
        setData(null);
      }
    };
    fetchDados();
  }, [adversario]);

  if (!data) return <div className="page">Carregando...</div>;

  return (
    <>
      <AppHeader title="Inteligência Eleitoral" subtitle="2º Turno - Geral" />
      <div className="page" style={{ paddingBottom: 104 }}>
        
        <div style={{ marginBottom: 16 }}>
          <select value={adversario} onChange={e => setAdversario(e.target.value)} style={{ padding: 8, width: '100%', borderRadius: 8 }}>
            <option value="">Selecione Adversário</option>
            {candidatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Card Hero */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="panel-title">Confronto Direto</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div><strong>Keiva Dias</strong> - {data.keiva || 0}%</div>
            <div><strong>{data.nomeAdversario || 'Adversário'}</strong> - {data.oponente || 0}%</div>
          </div>
          
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 8, borderRadius: 6, color: '#065F46', textAlign: 'center', fontWeight: 'bold' }}>
            <Icon name="trending_up" size={16} /> Keiva {data.vantagem > 0 ? '+' : ''}{data.vantagem || 0}%
          </div>

          <div style={{ display: 'flex', height: 8, marginTop: 16, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${data.keiva || 0}%`, background: '#10B981' }}></div>
            <div style={{ width: `${data.oponente || 0}%`, background: '#94A3B8' }}></div>
          </div>
        </div>

        {/* Demografia */}
        <div className="card">
          <h3 className="panel-title">Cruzamento Demográfico</h3>
          {data.demografia?.map(d => (
            <div key={d.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{d.label}</span>
                <span>{d.keiva || 0}% vs {d.oponente || 0}%</span>
              </div>
              <div style={{ display: 'flex', height: 6, marginTop: 4, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${d.keiva || 0}%`, background: '#10B981' }}></div>
                <div style={{ width: `${d.oponente || 0}%`, background: '#94A3B8' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}