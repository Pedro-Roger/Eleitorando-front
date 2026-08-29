import { useEffect, useRef, useState } from 'react';
import { fetchStates, fetchCities } from '../lib/ibge';
import Icon from './Icon';

// Seleção encadeada Estado → Cidade.
// O estado é fixo em Ceará (CE) por padrão da campanha; apenas a cidade é escolhida.
const FIXED_STATE = 'CE';
const FIXED_STATE_LABEL = 'Ceará (CE)';

function normalize(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function StateCitySelect({ state, city, onChange, disabled, allowStateChange = false, hideState = false, cityRequired = true }) {
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [query, setQuery] = useState(city || '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);

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

  // Mantém o texto digitado em sincronia quando a cidade muda por fora (reset de form, edição etc.)
  useEffect(() => {
    setQuery(city || '');
  }, [city]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(city || '');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [city]);

  const filtered = query.trim()
    ? cities.filter((c) => normalize(c).includes(normalize(query)))
    : cities;

  function selectCity(c) {
    onChange({ state: effectiveState, city: c });
    setQuery(c);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectCity(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(city || '');
    }
  }

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
      <div className="field" ref={boxRef}>
        <label>
          Cidade {cityRequired && <span className="req">*</span>}
        </label>
        <div className="input-icon">
          <Icon name="search" size={20} />
          <input
            value={query}
            disabled={disabled || !effectiveState || loadingCities}
            placeholder={loadingCities ? 'Carregando cidades...' : 'Digite para buscar a cidade'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
        </div>
        {open && filtered.length > 0 && (
          <div className="combobox-list">
            {filtered.map((c, i) => (
              <div
                key={c}
                className={`combobox-option${i === highlight ? ' is-highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCity(c);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                {c}
              </div>
            ))}
          </div>
        )}
        {open && query.trim() && filtered.length === 0 && (
          <div className="combobox-list">
            <div className="combobox-empty">Nenhuma cidade encontrada</div>
          </div>
        )}
      </div>
    </>
  );
}
