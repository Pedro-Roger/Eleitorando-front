import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getToken, getUser } from './lib/api';
import { ModalStackProvider } from './lib/modalStack';
import TabBar from './components/TabBar';
import SplashScreen from './components/SplashScreen';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Home from './pages/Home';
import Team from './pages/Team';
import Voters from './pages/Voters';
import Profile from './pages/Profile';
import Panel from './pages/Panel';
import Candidates from './pages/Candidates';
import Reports from './pages/Reports';
import Activities from './pages/Activities';
import Settings from './pages/Settings';
import Export from './pages/Export';

function Protected({ children }) {
  const token = getToken();
  if (!token) {
    if (typeof window !== 'undefined') {
      const entry = { at: new Date().toISOString(), event: 'protected:redirect', path: window.location.pathname };
      window.__authDebug = [...(window.__authDebug || []), entry].slice(-50);
      console.warn('[auth]', entry);
    }
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const user = getUser();
  const hideTabs = ['/login', '/trocar-senha'].includes(location.pathname);
  const isBrandHeader = ['/', '/perfil'].includes(location.pathname);
  const [booting, setBooting] = useState(true);

  return (
    <ModalStackProvider>
      <div className={`app-shell ${hideTabs ? 'auth-shell' : ''} ${isBrandHeader ? 'tall-header' : ''}`}>
        {booting && <SplashScreen onDone={() => setBooting(false)} />}
        {/* A rolagem acontece neste contêiner (e não no body): evita o bug do iOS Safari
            em que elementos position:fixed "flutuam" quando a altura da tela muda
            (ligação ativa, teclado aberto, barra do navegador recolhendo). */}
        <main className="app-scroll"><Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/trocar-senha" element={<ChangePassword />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/equipe" element={<Protected><Team /></Protected>} />
          <Route path="/eleitores" element={<Protected><Voters /></Protected>} />
          <Route path="/perfil" element={<Protected><Profile /></Protected>} />
          <Route path="/painel" element={<Protected><Panel /></Protected>} />
          <Route path="/candidatos" element={<Protected><Candidates /></Protected>} />
          <Route path="/relatorios" element={<Protected><Reports /></Protected>} />
          <Route path="/atividades" element={<Protected><Activities /></Protected>} />
          <Route path="/configuracoes" element={<Protected><Settings /></Protected>} />
          <Route path="/exportar" element={<Protected><Export /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></main>
        {!hideTabs && getToken() && <TabBar role={user?.role} />}
      </div>
    </ModalStackProvider>
  );
}
