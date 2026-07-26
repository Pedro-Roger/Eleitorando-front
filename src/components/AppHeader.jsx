import { useNavigate } from 'react-router-dom';
import { getUser } from '../lib/api';
import Icon from './Icon';
import logo from '../assets/logo-eleitorando.png';

export default function AppHeader({ title, subtitle, back = false }) {
  const navigate = useNavigate();
  const user = getUser();
  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const isBrand = title === 'Eleitorando';

  return (
    <header className={`app-header ${isBrand ? 'brand' : ''}`}>
      {isBrand ? (
        <span />
      ) : (
        <button
          className="icon-button"
          type="button"
          aria-label={back ? 'Voltar' : 'Ir para o início'}
          onClick={() => back ? navigate(-1) : navigate('/')}
        >
          <Icon name={back ? 'arrow_back' : 'menu'} />
        </button>
      )}
      {isBrand ? (
        <button className="app-header-logo-button" type="button" onClick={() => navigate('/')} aria-label="Ir para o início">
          <img src={logo} alt="Eleitorando" className="app-header-logo" />
        </button>
      ) : (
        <div className="app-header-copy">
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
      <div className="header-avatar" aria-label={`Perfil de ${user?.name || 'usuário'}`}>
        {initial}
      </div>
    </header>
  );
}
