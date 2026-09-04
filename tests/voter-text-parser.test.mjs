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

  assert.deepEqual(parsed, [{
    name: 'Nayele Rabelo Paulino',
    phone: '85921723287',
    age: '21',
    gender: 'Feminino',
    city: 'Fortaleza',
    neighborhood: 'Maraponga',
    zone: '118',
    section: '0116',
  }]);
});

test('keeps unknown and empty labels out of the result', () => {
  const parsed = parseVoterText(`
Nome completo:
Observacao: teste
Telefone: (85) 92172-3287
Zona: 118
`);

  assert.deepEqual(parsed, [{
    phone: '85921723287',
    zone: '118',
  }]);
});

test('parses multiple voters separated by repeated fields', () => {
  const parsed = parseVoterText(`
1
Nome completo: Alice
Telefone: 85999999999
2
Nome completo: Bob
Telefone: 85888888888
  `);

  assert.deepEqual(parsed, [
    { name: 'Alice', phone: '85999999999' },
    { name: 'Bob', phone: '85888888888' },
  ]);
});

test('handles garbage, empty text, or random strings gracefully', () => {
  assert.deepEqual(parseVoterText(''), []);
  assert.deepEqual(parseVoterText(undefined), []);
  assert.deepEqual(parseVoterText(null), []);
  assert.deepEqual(parseVoterText('Apenas um texto solto\nOutra linha sem dois pontos'), []);
});

test('handles label variations, case insensitivity, and accents', () => {
  const parsed = parseVoterText(`
Nômé Cõmplêtô : Carlos
 Cêlulár : 11999999999
íDãdê: 30
 Género: M
Cidáde :  São Paulo 
  bairrO: Centro
    Zoná eléitoral: 123
 Seçaõ: 456
 títuló: 1234567890
`);

  assert.deepEqual(parsed, [{
    name: 'Carlos',
    phone: '11999999999',
    age: '30',
    gender: 'Masculino',
    city: 'São Paulo',
    neighborhood: 'Centro',
    zone: '123',
    section: '456',
    titleNumber: '1234567890'
  }]);
});

test('cleans numeric fields removing symbols and letters', () => {
  const parsed = parseVoterText(`
Nome: Zezinho
Celular: (11) 9.8888-7777
Idade: 25 anos
Zona: 012a
Seção: 034-b
n titulo: 123.456.789-00
`);

  assert.deepEqual(parsed, [{
    name: 'Zezinho',
    phone: '11988887777',
    age: '25',
    zone: '012',
    section: '034',
    titleNumber: '12345678900'
  }]);
});

test('recognizes numero do titulo label and ignores endereco', () => {
  const parsed = parseVoterText(`
Nome completo: Maria de Fatima Xavier
Fernandes
Telefone: 85 92004-4903
Título: 0965 5189 0728
Seção: 440
Zona: 115
Bairro: Vila Peri
Endereço: não preenchido
`);

  assert.deepEqual(parsed, [{
    name: 'Maria de Fatima Xavier Fernandes',
    phone: '85920044903',
    titleNumber: '096551890728',
    section: '440',
    zone: '115',
    neighborhood: 'Vila Peri',
  }]);
});

test('recognizes numero do titulo variation from agreed format', () => {
  const parsed = parseVoterText(`
Nome completo: Nayele Rabelo Paulino
numero do titulo: 2310823820831
Celular: 85921723287
`);

  assert.deepEqual(parsed, [{
    name: 'Nayele Rabelo Paulino',
    titleNumber: '2310823820831',
    phone: '85921723287',
  }]);
});

test('normalizes gender variations correctly', () => {
  const variations = [
    { text: 'genero: f', expected: 'Feminino' },
    { text: 'genero: FEMININO', expected: 'Feminino' },
    { text: 'genero: fem', expected: 'Feminino' },
    { text: 'genero: M', expected: 'Masculino' },
    { text: 'genero: masc', expected: 'Masculino' },
    { text: 'genero: Masculino', expected: 'Masculino' },
    { text: 'genero: outro', expected: 'Outro' },
    { text: 'genero: Nao informado', expected: 'Nao informado' }
  ];

  variations.forEach(({ text, expected }) => {
    const parsed = parseVoterText(text);
    assert.equal(parsed[0].gender, expected, `Failed for: ${text}`);
  });
});
