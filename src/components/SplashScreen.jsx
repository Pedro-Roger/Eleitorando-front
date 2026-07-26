import { useEffect, useState } from 'react';
import logo from '../assets/logo-eleitorando.png';

// Tela de carregamento exibida uma única vez ao abrir o site,
// antes de renderizar a rota atual.
export default function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 1100);
    const doneTimer = setTimeout(() => onDone?.(), 1450);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`splash-screen ${leaving ? 'leaving' : ''}`}>
      <img src={logo} alt="Eleitorando" className="splash-logo" />
    </div>
  );
}
