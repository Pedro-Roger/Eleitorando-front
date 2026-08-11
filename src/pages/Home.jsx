import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser } from '../lib/api';
import AppHeader from '../components/AppHeader';
import BottomSheet from '../components/BottomSheet';
import Icon from '../components/Icon';

const roleName = {
  ADMIN: 'Administrador',
  CABO: 'Cabo eleitoral',
  SUBCABO: 'Subcabo eleitoral',
};

function Stat({ icon, value, label, tone, onClick }) {
  const content = (
    <>
      <div className="stat-head" style={tone ? { color: tone } : undefined}>
        <Icon name={icon} filled size={20} />
        <span className="label">{label}</span>
      </div>
      <div className="num">{value}</div>
    </>
  );
  if (!onClick) return <div className="stat">{content}</div>;
  return (
    <button type="button" className="stat tappable" onClick={onClick} aria-label={`Ver lista: ${label}`}>
      {content}
    </button>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const user = getUser();

  // Modal com a lista de cada cartão do painel (admin)
  const [listModal, setListModal] = useState(null); // { type, title }
  const [listData, setListData] = useState(null);

  function openList(type, title) {
    setListModal({ type, title });
    setListData(null);
    api(`/dashboard/list?type=${type}`)
      .then(setListData)
      .catch((e) => setListData({ error: e.message }));
  }

  // Ranking da equipe (admin): pódio + lista, alternando cabos/subcabos
  const [ranking, setRanking] = useState(null);
  const [rankTab, setRankTab] = useState('cabos');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
    if (user?.role === 'ADMIN') api('/dashboard/ranking').then(setRanking).catch(() => {});
  }, []);

  const rankList = ranking?.[rankTab] || [];
  const podium = rankList.slice(0, 3);
  const rankRest = rankList.slice(3, 10);

  return (
    <>
      <AppHeader title="Eleitorando" />
      <div className="page">
        <div className="page-intro">
          <h2>Início</h2>
          <p>Olá, {user?.name?.split(' ')[0] || roleName[user?.role]}</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        {!data && !error && <div className="empty">Carregando...</div>}

        {data?.role === 'ADMIN' && (
          <div className="dashboard-grid">
            <div>
              <div className="stats-grid">
                <Stat icon="groups" value={data.totalVoters} label="Eleitores Totais" onClick={() => openList('voters', 'Eleitores Totais')} />
                <Stat icon="person_add" value={data.votersToday} label="Cadastros Hoje" tone="var(--tertiary)" onClick={() => openList('today', 'Cadastros de Hoje')} />
                <Stat icon="manage_accounts" value={data.totalCabos} label="Total de Cabos" onClick={() => openList('cabos', 'Cabos Eleitorais')} />
                <Stat icon="supervisor_account" value={data.totalSubcabos} label="Total de Subcabos" tone="var(--secondary)" onClick={() => openList('subcabos', 'Subcabos Eleitorais')} />
              </div>
              <div className="quick-card">
                <h3>Acesso Rápido</h3>
                <div className="quick-actions">
                  <Link className="link-card" to="/eleitores">
                    <span className="btn"><Icon name="person_add" />Novo Eleitor</span>
                  </Link>
                  <Link className="link-card" to="/equipe">
                    <span className="btn secondary"><Icon name="group_add" />Novo Membro</span>
                  </Link>
                </div>
              </div>

              <div className="section-title">Ranking da Equipe</div>
              <div className="segmented-tabs" role="tablist" aria-label="Tipo de ranking">
                <button className={`tab ${rankTab === 'cabos' ? 'active' : ''}`} onClick={() => setRankTab('cabos')} role="tab" aria-selected={rankTab === 'cabos'}>
                  Cabos
                </button>
                <button className={`tab ${rankTab === 'subcabos' ? 'active' : ''}`} onClick={() => setRankTab('subcabos')} role="tab" aria-selected={rankTab === 'subcabos'}>
                  Subcabos
                </button>
              </div>

              {podium.length > 0 && (
                <div className="podium">
                  {[podium[1], podium[0], podium[2]].map((p, i) => {
                    const pos = i === 1 ? 1 : i === 0 ? 2 : 3;
                    if (!p) return <div key={`vazio-${pos}`} className="podium-step" />;
                    return (
                      <div key={p.id} className={`podium-step podium-${pos}`}>
                        <div className="podium-medal">{pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}</div>
                        <div className="podium-name">{p.name}</div>
                        <div className="podium-count">{p.total} eleitor{p.total === 1 ? '' : 'es'}</div>
                        <div className="podium-bar">{pos}º</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {rankRest.length > 0 && (
                <div className="card list-divided">
                  {rankRest.map((p, idx) => (
                    <div key={p.id} className="rank-row">
                      <span className="rank-pos">{idx + 4}º</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rank-name">{p.name}</div>
                        {rankTab === 'subcabos' && p.caboName && <div className="meta">Cabo: {p.caboName}</div>}
                      </div>
                      <span className="rank-total">{p.total}</span>
                    </div>
                  ))}
                </div>
              )}

              {rankList.length === 0 && (
                <div className="card"><div className="meta">Sem dados para o ranking ainda.</div></div>
              )}
            </div>
            <div>
              <h3 className="panel-title">Atividades Recentes</h3>
              <Link className="link-card" to="/atividades">
                <div className="card tappable card-row">
                  <div className="card-leading">
                    <div className="avatar"><Icon name="history" size={18} /></div>
                    <div><div className="card-title">Histórico de atividades</div><div className="meta">Ações recentes da equipe</div></div>
                  </div>
                  <Icon name="chevron_right" />
                </div>
              </Link>
              <Link className="link-card" to="/relatorios">
                <div className="card tappable card-row">
                  <div className="card-leading">
                    <div className="avatar"><Icon name="analytics" size={18} /></div>
                    <div><div className="card-title">Resultados e relatórios</div><div className="meta">Consolidado da campanha</div></div>
                  </div>
                  <Icon name="chevron_right" />
                </div>
              </Link>
              <Link className="link-card" to="/exportar">
                <div className="card tappable card-row">
                  <div className="card-leading">
                    <div className="avatar"><Icon name="ios_share" size={18} /></div>
                    <div><div className="card-title">Exportar dados</div><div className="meta">Compartilhar eleitores em XLS, CSV, PDF</div></div>
                  </div>
                  <Icon name="chevron_right" />
                </div>
              </Link>
              <Link className="link-card" to="/configuracoes">
                <div className="card tappable card-row">
                  <div className="card-leading">
                    <div className="avatar"><Icon name="settings" size={18} /></div>
                    <div><div className="card-title">Configurações gerais</div><div className="meta">Regras do cadastro</div></div>
                  </div>
                  <Icon name="chevron_right" />
                </div>
              </Link>
              <div className="section-title">Eleitores por cidade</div>
              <div className="card">
                {data.byCity.length === 0 && <div className="meta">Nenhum eleitor cadastrado ainda.</div>}
                {data.byCity.map((r) => {
                  const max = data.byCity[0]?.total || 1;
                  return (
                    <div className="bar-row" key={`${r.state}-${r.city}`}>
                      <span className="name">{r.city}/{r.state}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.total / max) * 100}%` }} /></div>
                      <span className="val">{r.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {data?.role === 'CABO' && (
          <>
            <div className="stats-grid">
              <Stat icon="groups" value={data.teamVoters} label="Eleitores da equipe" to="/eleitores" />
              <Stat icon="person_add" value={data.votersToday} label="Cadastros hoje" to="/eleitores?hoje=1" />
              <Stat icon="how_to_reg" value={data.ownVoters} label="Meus cadastros" to="/eleitores?membro=me" />
              <Stat icon="supervisor_account" value={data.subcabosCount} label="Subcabos" to="/equipe" />
            </div>
            <div className="section-title">Desempenho por subcabo</div>
            <div className="card">
              {data.bySubcabo.length === 0 && <div className="meta">Você ainda não tem subcabos. Crie na aba Equipe.</div>}
              {data.bySubcabo.map((s) => {
                const max = Math.max(...data.bySubcabo.map((x) => x.total), 1);
                return (
                  <div className="bar-row" key={s.id}>
                    <span className="name">{s.name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.total / max) * 100}%` }} /></div>
                    <span className="val">{s.total}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {data?.role === 'SUBCABO' && (
          <>
            <div className="stats-grid">
              <Stat icon="how_to_reg" value={data.ownVoters} label="Meus cadastros" to="/eleitores" />
              <Stat icon="person_add" value={data.votersToday} label="Cadastros hoje" to="/eleitores?hoje=1" />
            </div>
            {data.parentName && (
              <div className="card">
                <div className="card-title">Cabo responsável</div>
                <div className="meta">{data.parentName}</div>
              </div>
            )}
            <Link to="/eleitores" style={{ textDecoration: 'none' }}>
              <span className="btn" style={{ marginTop: 8 }}><Icon name="person_add" />Cadastrar eleitor</span>
            </Link>
          </>
        )}
      </div>

      {/* Modal com a lista do cartão clicado */}
      <BottomSheet open={!!listModal} onClose={() => setListModal(null)} title={listModal?.title}>
        {!listData && <div className="empty">Carregando...</div>}
        {listData?.error && <div className="alert error">{listData.error}</div>}
        {listData?.items && (
          <>
            {listData.items.length === 0 && <div className="empty">Nada por aqui ainda.</div>}
            {listData.items.length > 0 && (
              <div className="card list-divided">
                {listData.items.map((it) => (
                  <div key={it.id}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{it.title}</div>
                    <div className="meta">{it.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
            {listData.total > listData.items.length && (
              <div className="meta" style={{ marginTop: 8 }}>
                Mostrando os {listData.items.length} mais recentes de {listData.total}.
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}
