import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';

const icons = {
  LOGIN: 'login',
  USUARIO_CRIADO: 'person_add',
  USUARIO_EDITADO: 'edit',
  CONTA_ATIVADA: 'check_circle',
  CONTA_DESATIVADA: 'block',
  SENHA_REDEFINIDA: 'lock_reset',
  SENHA_ALTERADA: 'password',
  ELEITOR_CADASTRADO: 'how_to_vote',
  CONFIG_ALTERADA: 'settings',
};

export default function Activities() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/activities')
      .then((d) => setItems(d.activities))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <AppHeader title="Histórico de atividades" subtitle="Ações recentes no sistema" back />
      <div className="page">
        {error && <div className="alert error">{error}</div>}
        {!items && !error && <div className="empty">Carregando...</div>}
        {items?.length === 0 && <div className="empty"><Icon name="history" />Nada registrado ainda.</div>}
        {items && (
          <div className="card list-divided">
            {items.map((a) => (
              <div key={a.id}>
                <div style={{ fontSize: '0.88rem' }}>
                  <Icon name={icons[a.action] || 'circle'} size={18} /> {a.detail}
                </div>
                <div className="meta">{new Date(a.createdAt).toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
