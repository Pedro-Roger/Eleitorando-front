import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

const roleName = {
  ADMIN: 'Administrador',
  CABO: 'Cabo eleitoral',
  SUBCABO: 'Subcabo eleitoral',
};

function Stat({ icon, value, label, tone }) {
  return (
    <div className="stat">
      <div className="stat-head" style={tone ? { color: tone } : undefined}>
        <Icon name={icon} filled size={20} />
        <span className="label">{label}</span>
      </div>
      <div className="num">{value}</div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

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
                <Stat icon="groups" value={data.totalVoters} label="Eleitores Totais" />
                <Stat icon="person_add" value={data.votersToday} label="Cadastros Hoje" tone="var(--tertiary)" />
                <Stat icon="manage_accounts" value={data.totalCabos} label="Total de Cabos" />
                <Stat icon="supervisor_account" value={data.totalSubcabos} label="Total de Subcabos" tone="var(--secondary)" />
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
              <Link className="link-card" to="/candidatos">
                <div className="card tappable card-row">
                  <div className="card-leading">
                    <div className="avatar"><Icon name="how_to_vote" size={18} /></div>
                    <div><div className="card-title">Candidatos</div><div className="meta">Referência de intenção de voto</div></div>
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
              <Stat icon="groups" value={data.teamVoters} label="Eleitores da equipe" />
              <Stat icon="person_add" value={data.votersToday} label="Cadastros hoje" />
              <Stat icon="how_to_reg" value={data.ownVoters} label="Meus cadastros" />
              <Stat icon="supervisor_account" value={data.subcabosCount} label="Subcabos" />
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
              <Stat icon="how_to_reg" value={data.ownVoters} label="Meus cadastros" />
              <Stat icon="person_add" value={data.votersToday} label="Cadastros hoje" />
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
    </>
  );
}
