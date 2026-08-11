import { useState } from 'react';
import StateCitySelect from './StateCitySelect';
import Icon from './Icon';

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

  const canSave = form.name.trim() && form.phone.replace(/\D/g, '') && form.state && form.city;

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
        <label>Nome completo <span className="req">*</span></label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Maria da Silva" />
      </div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Celular <span className="req">*</span></label>
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
        onChange={({ state, city }) => setForm({ ...form, state, city })}
      />
      <div className="field">
        <label>Bairro</label>
        <input
          value={form.neighborhood}
          onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
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
      <button className="btn" disabled={!canSave || submitting}>
        <Icon name="save" size={18} />
        {submitting ? 'Salvando...' : submitLabel}
      </button>
    </form>
  );
}
