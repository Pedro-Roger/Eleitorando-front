import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import AppHeader from '../components/AppHeader';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [meta, setMeta] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api('/settings').then((d) => { setSettings(d.settings); setMeta(d.settings.metaCampanha || ''); }).catch((e) => setError(e.message));
  }, []);

  async function toggle(key) {
    const value = settings[key] === 'true' ? 'false' : 'true';
    try {
      const d = await api('/settings', { method: 'PATCH', body: { [key]: value } });
      setSettings(d.settings);
      setMsg('Configuração salva.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveMeta(e) {
    e.preventDefault();
    try {
      const d = await api('/settings', { method: 'PATCH', body: { metaCampanha: meta } });
      setSettings(d.settings);
      setMsg('Meta da campanha salva.');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <AppHeader title="Configurações gerais" subtitle="Regras do sistema" back />
      <div className="page">
        {msg && <div className="alert success">{msg}</div>}
        {error && <div className="alert error">{error}</div>}
        {!settings && !error && <div className="empty">Carregando...</div>}
        {settings && (
          <>
            <div className="card">
              <div className="switch-row">
                <div>
                  <div>Bairro obrigatório no eleitor</div>
                  <div className="meta">Exigir o preenchimento do bairro ao cadastrar eleitores.</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.bairroObrigatorioEleitor === 'true'}
                    onChange={() => toggle('bairroObrigatorioEleitor')}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>

            <div className="card">
              <form onSubmit={saveMeta}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Meta da campanha</label>
                  <input
                    type="number"
                    min="0"
                    value={meta}
                    onChange={(e) => setMeta(e.target.value)}
                    placeholder="Ex.: 10000"
                  />
                  <div className="hint">Total de eleitores que a campanha pretende alcançar. Usado na tela de Resultados.</div>
                </div>
                <button className="btn secondary" style={{ marginTop: 8 }}>Salvar meta</button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}
