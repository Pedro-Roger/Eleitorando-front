import { useEffect, useState } from 'react';
import { fetchStates, fetchCities } from '../lib/ibge';

// Seleção encadeada Estado → Cidade.
// O estado é fixo em Ceará (CE) por padrão da campanha; apenas a cidade é escolhida.
const FIXED_STATE = 'CE';
const FIXED_STATE_LABEL = 'Ceará (CE)';

export default function StateCitySelect({ state, city, onChange, disabled, allowStateChange = false, hideState = false, cityRequired = true }) {
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const effectiveState = allowStateChange ? state : FIXED_STATE;

  useEffect(() => {
    if (allowStateChange) fetchStates().then(setStates).catch(() => setStates([]));
  }, [allowStateChange]);

  // Garante que o formulário sempre tenha o estado fixo preenchido
  useEffect(() => {
    if (!allowStateChange && state !== FIXED_STATE) {
      onChange({ state: FIXED_STATE, city: city || '' });
    }
  }, [allowStateChange, state]);

  useEffect(() => {
    if (!effectiveState) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    fetchCities(effectiveState)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [effectiveState]);

  return (
    <>
      {!hideState && (
        <div className="field">
          <label>
            Estado <span className="req">*</span>
          </label>
          {allowStateChange ? (
            <select
              value={state || ''}
              disabled={disabled}
              onChange={(e) => onChange({ state: e.target.value, city: '' })}
            >
              <option value="">Selecione o estado</option>
              {states.map((s) => (
                <option key={s.sigla} value={s.sigla}>
                  {s.nome} ({s.sigla})
                </option>
              ))}
            </select>
          ) : (
            <input value={FIXED_STATE_LABEL} disabled />
          )}
        </div>
      )}
      <div className="field">
        <label>
          Cidade {cityRequired && <span className="req">*</span>}
        </label>
        <select
          value={city || ''}
          disabled={disabled || !effectiveState || loadingCities}
          onChange={(e) => onChange({ state: effectiveState, city: e.target.value })}
        >
          <option value="">{loadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
