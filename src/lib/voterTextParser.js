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
  'num titulo': 'titleNumber',
  'numero titulo': 'titleNumber',
  'numero do titulo': 'titleNumber',
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

// Campos de texto aceitam continuação na linha seguinte (ex.: nome quebrado
// em duas linhas ao colar). Linhas sem ":" fora desse contexto são ignoradas.
const TEXT_FIELDS = new Set(['name', 'city', 'neighborhood', 'notes']);

export function parseVoterText(text) {
  const voters = [];
  let currentVoter = {};
  let lastField = null;

  function pushCurrent() {
    if (Object.keys(currentVoter).length > 0) voters.push(currentVoter);
    currentVoter = {};
    lastField = null;
  }

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^([^:]+)\s*:\s*(.*?)\s*$/);
    if (!match) {
      if (lastField && TEXT_FIELDS.has(lastField) && currentVoter[lastField]) {
        currentVoter[lastField] += ` ${line}`;
      }
      continue;
    }

    const field = LABELS[normalizeLabel(match[1])];
    if (!field) {
      lastField = null;
      continue;
    }

    const value = cleanValue(field, match[2]);
    if (!value) continue;

    if (currentVoter[field] !== undefined) {
      pushCurrent();
    }
    currentVoter[field] = value;
    lastField = field;
  }

  pushCurrent();
  return voters;
}
