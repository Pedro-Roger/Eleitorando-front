import { useState } from 'react';
import StateCitySelect from './StateCitySelect';

// Formulário de criação de cabo/subcabo — usado apenas pelo administrador.
// role: 'CABO' | 'SUBCABO'
// cabos: lista de cabos para escolher o responsável (obrigatório quando role = SUBCABO)
export default function UserForm({ role, cabos = [], onSubmit, submitting, error }) {
  const isSubcabo = role === 'SUBCABO';
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    state: 'CE',
    city: '',
    neighborhood: '',
    active: true,
    parentId: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSave =
    form.name.trim() &&
    form.username.trim() &&
    form.password &&
    form.confirmPassword &&
    form.state &&
    form.city &&
    (!isSubcabo || form.parentId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, role });
      }}
    >
      {error && <div className="alert error">{error}</div>}

      {isSubcabo && (
        <div className="field">
          <label>
            Cabo responsável <span className="req">*</span>
          </label>
          <select value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
            <option value="">Selecione o cabo eleitoral</option>
            {cabos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}/{c.state}
              </option>
            ))}
          </select>
          <div className="hint">O subcabo ficará vinculado a este cabo eleitoral.</div>
        </div>
      )}

      <div className="field">
        <label>
          Nome completo <span className="req">*</span>
        </label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e sobrenome" />
      </div>
      <div className="field">
        <label>
          Usuário <span className="req">*</span>
        </label>
        <input
          value={form.username}
          onChange={(e) => set('username', e.target.value.toLowerCase())}
          placeholder="ex.: joao.silva"
          autoCapitalize="none"
        />
      </div>
      <div className="field">
        <label>
          Senha inicial <span className="req">*</span>
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Mínimo 8 caracteres, letras e números"
        />
      </div>
      <div className="field">
        <label>
          Confirmar senha <span className="req">*</span>
        </label>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => set('confirmPassword', e.target.value)}
          placeholder="Repita a senha"
        />
      </div>
      <div className="field">
        <label>Telefone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>

      <StateCitySelect
        state={form.state}
        city={form.city}
        onChange={({ state, city }) => setForm((f) => ({ ...f, state, city }))}
      />

      <div className="field">
        <label>Bairro principal</label>
        <input
          value={form.neighborhood}
          onChange={(e) => set('neighborhood', e.target.value)}
          placeholder="Opcional"
        />
      </div>

      <div className="switch-row">
        <span>Conta ativa</span>
        <label className="switch">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span className="track" />
        </label>
      </div>

      <button className="btn" type="submit" disabled={!canSave || submitting}>
        {submitting ? 'Salvando...' : isSubcabo ? 'Criar subcabo' : 'Criar cabo eleitoral'}
      </button>
    </form>
  );
}
