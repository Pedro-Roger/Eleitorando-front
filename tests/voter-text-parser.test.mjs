import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVoterText } from '../src/lib/voterTextParser.js';

test('parses labeled voter text into form fields', () => {
  const parsed = parseVoterText(`
nome completo: Nayele Rabelo Paulino

Celular: 85921723287

Idade: 21

Gênero: feminino

Cidade: Fortaleza

Bairro: Maraponga

Zona eleitoral: 118

Seção: 0116
`);

  assert.deepEqual(parsed, {
    name: 'Nayele Rabelo Paulino',
    phone: '85921723287',
    age: '21',
    gender: 'Feminino',
    city: 'Fortaleza',
    neighborhood: 'Maraponga',
    zone: '118',
    section: '0116',
  });
});

test('keeps unknown and empty labels out of the result', () => {
  const parsed = parseVoterText(`
Nome completo:
Observacao: teste
Telefone: (85) 92172-3287
Zona: 118
`);

  assert.deepEqual(parsed, {
    phone: '85921723287',
    zone: '118',
  });
});
