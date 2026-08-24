import { useEffect, useRef, useState } from 'react';
import StateCitySelect from './StateCitySelect';
import Icon from './Icon';
import { api } from '../lib/api';

const GENDERS = ['Feminino', 'Masculino', 'Outro', 'Prefere não informar'];

// Formulário de cadastro/edição de eleitor — reutilizado tanto no "Novo Eleitor"
// quanto na edição de um eleitor já existente (initial preenchido).
export default function VoterForm({ initial, onSubmit, submitting, error, submitLabel = 'Salvar Cadastro' }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    phone: initial?.phone || '',
    state: initial?.state || 'CE',
    city: initial?.city || '',
    neighborhood: initial?.neighborhood || '',
    gender: initial?.gender || '',
    age: initial?.age ?? '',
    zone: initial?.zone || '',
    section: initial?.section || '',
    notes: initial?.notes || '',
  });
  const [zoneSecaoStatus, setZoneSecaoStatus] = useState(''); // '', 'found', 'not-found'
  const autoFilledRef = useRef({ city: false, neighborhood: false });

  // Quando zona + seção são preenchidas (Ceará), busca cidade/bairro na tabela do
  // TRE-CE e preenche automaticamente — só sobrescreve campos que o usuário não
  // digitou manualmente (ou que já vieram do próprio autofill numa consulta anterior).
  useEffect(() => {
    const zone = form.zone.replace(/\D/g, '');
    const section = form.section.replace(/\D/g, '');
    if (form.state !== 'CE' || !zone || !section) {
      setZoneSecaoStatus('');
      return;
    }
    const timer = setTimeout(() => {
      api(`/voters/lookup-zona-secao?zone=${zone}&section=${section}`)
        .then(({ match }) => {
          if (!match) {
            setZoneSecaoStatus('not-found');
            return;
          }
          setZoneSecaoStatus('found');
          setForm((f) => {
            const next = { ...f };
            if (match.city && (!f.city || autoFilledRef.current.city)) {
              next.city = match.city;
              autoFilledRef.current.city = true;
            }
            if (match.neighborhood && (!f.neighborhood || autoFilledRef.current.neighborhood)) {
              next.neighborhood = match.neighborhood;
              autoFilledRef.current.neighborhood = true;
            }
            return next;
          });
        })
        .catch(() => setZoneSecaoStatus(''));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.zone, form.section, form.state]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      {error && <div className="alert error">{error}</div>}

      <h3 className="form-section-title">Dados Pessoais</h3>
      <div className="field">
        <label>Nome completo</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Maria da Silva" />
      </div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Celular</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Idade</label>
          <input
            type="number"
            min="16"
            max="120"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder="Ex.: 34"
          />
        </div>
      </div>
      <div className="field">
        <label>Gênero</label>
        <div className="pill-select">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              className={`pill-option ${form.gender === g ? 'active' : ''}`}
              onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <h3 className="form-section-title">Localização e Eleitoral</h3>
      <StateCitySelect
        state={form.state}
        city={form.city}
        hideState
        cityRequired={false}
        onChange={({ state, city }) => {
          autoFilledRef.current.city = false;
          setForm({ ...form, state, city });
        }}
      />
      <div className="field">
        <label>Bairro</label>
        <input
          value={form.neighborhood}
          onChange={(e) => {
            autoFilledRef.current.neighborhood = false;
            setForm({ ...form, neighborhood: e.target.value });
          }}
          placeholder="Bairro do eleitor"
        />
      </div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Zona eleitoral</label>
          <input
            inputMode="numeric"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            placeholder="Ex.: 012"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Seção</label>
          <input
            inputMode="numeric"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            placeholder="Ex.: 0345"
          />
        </div>
      </div>
      {zoneSecaoStatus === 'found' && (
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          <Icon name="check_circle" size={14} /> Cidade e bairro preenchidos a partir da zona/seção.
        </div>
      )}
      {zoneSecaoStatus === 'not-found' && (
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          <Icon name="info" size={14} /> Zona/seção não encontrada — preencha cidade e bairro manualmente.
        </div>
      )}

      <h3 className="form-section-title">Detalhes Adicionais</h3>
      <div className="field">
        <label>Observações</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Opcional"
        />
      </div>
      <button className="btn" disabled={submitting}>
        <Icon name="save" size={18} />
        {submitting ? 'Salvando...' : submitLabel}
      </button>
    </form>
  );
}
