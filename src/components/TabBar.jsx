import { NavLink } from 'react-router-dom';
import Icon from './Icon';

export default function TabBar({ role }) {
  const tabs = [
    { to: '/', icon: 'home', label: 'Início' },
    ...(role !== 'SUBCABO' ? [{ to: '/equipe', icon: 'group', label: 'Equipe' }] : []),
    { to: '/eleitores', icon: 'person_search', label: 'Eleitores' },
    { to: '/painel', icon: 'analytics', label: 'Demográfico' },
    { to: '/perfil', icon: 'account_circle', label: 'Perfil' },
  ];
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <Icon name={t.icon} filled={isActive} />
              <span>{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
