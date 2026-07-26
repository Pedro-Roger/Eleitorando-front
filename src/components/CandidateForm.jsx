import { useRef, useState } from 'react';
import Icon from './Icon';
import { assetUrl } from '../lib/api';

// Formulário de cadastro/edição de candidato — usado apenas pelo administrador.
// candidate: quando presente, pré-carrega os campos para edição.
export default function CandidateForm({ candidate, onSubmit, submitting, error }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(candidate?.name || '');
  const [party, setParty] = useState(candidate?.party || '');
  const [active, setActive] = useState(candidate ? candidate.active : true);
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(candidate?.photoUrl ? assetUrl(candidate.photoUrl) : null);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  }

  const canSave = name.trim() && party.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('party', party.trim());
        formData.append('active', String(active));
        if (photoFile) formData.append('photo', photoFile);
        onSubmit(formData);
      }}
    >
      {error && <div className="alert error">{error}</div>}

      <div className="candidate-photo-picker">
        <button
          type="button"
          className="candidate-photo-button"
          onClick={() => fileRef.current?.click()}
          aria-label="Selecionar foto do candidato"
        >
          {preview ? (
            <img src={preview} alt="" />
          ) : (
            <Icon name="add_a_photo" size={28} />
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handlePhoto} />
        <span className="hint">Foto do candidato (opcional, JPEG/PNG/WEBP até 4MB)</span>
      </div>

      <div className="field">
        <label>
          Nome do candidato <span className="req">*</span>
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
      </div>
      <div className="field">
        <label>
          Partido <span className="req">*</span>
        </label>
        <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Ex.: PSD, PL, PT..." />
      </div>

      <div className="switch-row">
        <span>Candidato ativo</span>
        <label className="switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span className="track" />
        </label>
      </div>

      <button className="btn" type="submit" disabled={!canSave || submitting}>
        {submitting ? 'Salvando...' : candidate ? 'Salvar alterações' : 'Cadastrar candidato'}
      </button>
    </form>
  );
}
