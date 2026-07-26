import { useEffect, useState } from 'react';
import { api, getUser, assetUrl } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

const scopeLabel = {
  ADMIN: 'Toda a campanha',
  CABO: 'Sua equipe',
  SUBCABO: 'Seus cadastros',
};

function BarList({ rows, nameOf, color }) {
  if (!rows?.length) return <div className="meta">Sem dados ainda.</div>;
  const total = Math.max(rows.reduce((sum, r) => sum + r.total, 0), 1);
  return rows.map((r, i) => (
    <div className="bar-row" key={i}>
      <span className="name">{nameOf(r)}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${(r.total / total) * 100}%`, background: color }} />
      </div>
      <span className="val">{Math.round((r.total / total) * 100)}%</span>
    </div>
  ));
}

function CandidateIntentionList({ rows, withoutCandidate }) {
  const all = [...(rows || []), ...(withoutCandidate > 0 ? [{ candidateId: 'none', name: 'Sem candidato definido', party: null, total: withoutCandidate }] : [])];
  if (!all.length) return <div className="meta">Sem dados ainda.</div>;
  const total = Math.max(all.reduce((sum, r) => sum + r.total, 0), 1);
  return all.map((r) => (
    <div className="candidate-intention-row" key={r.candidateId}>
      <div className="avatar candidate-avatar small">
        {r.photoUrl ? <img src={assetUrl(r.photoUrl)} alt="" /> : r.party ? r.name.slice(0, 2).toUpperCase() : <Icon name="person_off" size={16} />}
      </div>
      <div className="candidate-intention-copy">
        <div className="bar-row" style={{ marginBottom: 0 }}>
          <span className="name">{r.name}{r.party ? ` (${r.party})` : ''}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.total / total) * 100}%` }} />
          </div>
          <span className="val">{Math.round((r.total / total) * 100)}%</span>
        </div>
      </div>
    </div>
  ));
}

export default function Panel() {
  const me = getUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/demographics').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <AppHeader title="Demográfico" subtitle={scopeLabel[me?.role] || ''} />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <div className="empty">Carregando...</div>}
        {data && (
          <>
            <div className="card demographic-card">
              <h2 className="panel-title">Intenção de Voto</h2>
              <CandidateIntentionList rows={data.byCandidate} withoutCandidate={data.withoutCandidate} />
            </div>

            <div className="card demographic-card">
              <h2 className="panel-title">Distribuição por Gênero</h2>
              <BarList rows={data.byGender} nameOf={(r) => r.gender} />
            </div>

            <div className="card demographic-card">
              <h2 className="panel-title">Faixa Etária</h2>
              <BarList rows={data.byAge} nameOf={(r) => `${r.range} anos`} color="var(--primary-container)" />
            </div>

            <div className="card demographic-card">
              <h2 className="panel-title">Zonas Eleitorais</h2>
              <BarList rows={data.byZone} nameOf={(r) => `Zona ${r.zone}`} color="var(--primary)" />
            </div>

            <div className="card demographic-card">
              <h2 className="panel-title">Principais Cidades</h2>
              <BarList rows={data.byCity} nameOf={(r) => `${r.city}/${r.state}`} color="var(--secondary)" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
