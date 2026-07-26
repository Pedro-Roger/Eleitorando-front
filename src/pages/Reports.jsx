import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

function formatCompact(n) {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function BarList({ rows, nameOf }) {
  if (!rows?.length) return <div className="meta">Sem dados ainda.</div>;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return rows.map((r, i) => (
    <div className="bar-row" key={i}>
      <span className="name">{nameOf(r)}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.total / max) * 100}%` }} /></div>
      <span className="val">{r.total}</span>
    </div>
  ));
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('geral');

  useEffect(() => {
    api('/dashboard/reports').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <AppHeader title="Resultados" subtitle="Relatórios da Campanha" />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <div className="empty">Carregando...</div>}
        {data && (
          <>
            <div className="filter-chips" role="tablist" aria-label="Relatórios">
              <button role="tab" aria-selected={tab === 'geral'} className={`filter-chip ${tab === 'geral' ? 'active' : ''}`} onClick={() => setTab('geral')}>Geral</button>
              <button role="tab" aria-selected={tab === 'regiao'} className={`filter-chip ${tab === 'regiao' ? 'active' : ''}`} onClick={() => setTab('regiao')}>Por Região</button>
              <button role="tab" aria-selected={tab === 'equipe'} className={`filter-chip ${tab === 'equipe' ? 'active' : ''}`} onClick={() => setTab('equipe')}>Por Equipe</button>
            </div>

            {tab === 'geral' && (
              <>
                <div className="card report-hero">
                  <h2 className="card-title"><Icon name="groups" filled size={20} /> Total Consolidado</h2>
                  <div className="report-total">{formatCompact(data.campaignTotal)}</div>
                  <div className="meta">Eleitores cadastrados até o momento</div>
                </div>

                {data.meta ? (
                  <div className="card">
                    <div className="list-caption" style={{ margin: 0 }}>Meta da Campanha</div>
                    <div className="card-row" style={{ marginTop: 10, marginBottom: 12 }}>
                      <span style={{ fontWeight: 700 }}>{formatCompact(data.meta)} Alvo</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 18 }}>
                        {Math.min(100, Math.round((data.campaignTotal / data.meta) * 100))}%
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${Math.min(100, (data.campaignTotal / data.meta) * 100)}%` }}
                      />
                    </div>
                    {data.weeklyNew > 0 && (
                      <div className="meta" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="trending_up" size={14} color="var(--success)" /> +{formatCompact(data.weeklyNew)} esta semana
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card">
                    <div className="meta">
                      Defina uma meta em Configurações gerais para acompanhar o progresso da campanha aqui.
                    </div>
                  </div>
                )}

                <div className="mini-stats">
                  <div className="card mini-stat">
                    <Icon name="location_city" color="var(--secondary)" />
                    <div className="card-title">{data.byCity.length}</div>
                    <div className="meta">Cidades alcançadas</div>
                  </div>
                  <div className="card mini-stat">
                    <Icon name="groups" />
                    <div className="card-title">{data.byCabo.length}</div>
                    <div className="meta">Equipes ativas</div>
                  </div>
                </div>
              </>
            )}

            {tab === 'regiao' && (
              <>
                <div className="section-title">Por estado</div>
                <div className="card"><BarList rows={data.byState} nameOf={(r) => r.state} /></div>
                <div className="section-title">Por cidade</div>
                <div className="card"><BarList rows={data.byCity} nameOf={(r) => `${r.city}/${r.state}`} /></div>
              </>
            )}

            {tab === 'equipe' && (
              <>
                <div className="section-title">Por cabo eleitoral (equipe completa)</div>
                <div className="card"><BarList rows={data.byCabo} nameOf={(r) => r.name} /></div>
                <div className="section-title">Por subcabo</div>
                <div className="card">
                  <BarList rows={data.bySubcabo} nameOf={(r) => `${r.name}${r.caboName ? ` (${r.caboName})` : ''}`} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
