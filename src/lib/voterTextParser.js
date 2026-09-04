const LABELS = {
  nome: 'name',
  'nome completo': 'name',
  celular: 'phone',
  telefone: 'phone',
  idade: 'age',
  genero: 'gender',
  cidade: 'city',
  bairro: 'neighborhood',
  zona: 'zone',
  'zona eleitoral': 'zone',
  secao: 'section',
  'n titulo': 'titleNumber',
  titulo: 'titleNumber',
};

function normalizeLabel(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeGender(value) {
  const text = normalizeLabel(value);
  if (text === 'f' || text.startsWith('fem')) return 'Feminino';
  if (text === 'm' || text.startsWith('masc')) return 'Masculino';
  if (text.startsWith('outro')) return 'Outro';
  return String(value || '').trim();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function cleanValue(field, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (field === 'phone' || field === 'age' || field === 'zone' || field === 'section' || field === 'titleNumber') {
    return digits(trimmed);
  }
  if (field === 'gender') return normalizeGender(trimmed);
  return trimmed;
}

export function parseVoterText(text) {
  const voters = [];
  let currentVoter = {};

  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;

    const field = LABELS[normalizeLabel(match[1])];
    if (!field) continue;

    const value = cleanValue(field, match[2]);
    if (value) {
      if (currentVoter[field] !== undefined) {
        voters.push(currentVoter);
        currentVoter = {};
      }
      currentVoter[field] = value;
    }
  }

  if (Object.keys(currentVoter).length > 0) {
    voters.push(currentVoter);
  }

  return voters;
}
