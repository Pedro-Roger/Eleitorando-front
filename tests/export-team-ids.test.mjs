import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCreatedByIds } from '../src/lib/exportTeamIds.js';

// Árvore de equipe fixa para os testes:
// cabo 1 (com subcabos 10, 11) e cabo 2 (com subcabos 20, 21)
const CABOS = [
  { id: 1, name: 'Cabo Um', subcabos: [{ id: 10, name: 'Sub A' }, { id: 11, name: 'Sub B' }] },
  { id: 2, name: 'Cabo Dois', subcabos: [{ id: 20, name: 'Sub C' }, { id: 21, name: 'Sub D' }] },
];
const SUB_OPTIONS = CABOS.flatMap((c) => c.subcabos.map((s) => ({ ...s, caboName: c.name })));
const base = { cabos: CABOS, selSubs: {}, subcabo: '', subcaboOptions: SUB_OPTIONS };

test('nada marcado = todos da equipe (lista vazia)', () => {
  assert.deepEqual(buildCreatedByIds({ ...base, selCabos: [] }), []);
});

test('cabo marcado sem subcabos marcados = cabo + todos os subcabos dele', () => {
  assert.deepEqual(buildCreatedByIds({ ...base, selCabos: [1] }), [1, 10, 11]);
});

test('cabo marcado com subcabos marcados = SÓ os subcabos (eleitores do cabo ficam de fora)', () => {
  assert.deepEqual(
    buildCreatedByIds({ ...base, selCabos: [1], selSubs: { 1: [10] } }),
    [10]
  );
  assert.deepEqual(
    buildCreatedByIds({ ...base, selCabos: [1], selSubs: { 1: [10, 11] } }),
    [10, 11]
  );
});

test('dois cabos: regra por cabo (um com subs marcados, outro sem)', () => {
  assert.deepEqual(
    buildCreatedByIds({ ...base, selCabos: [1, 2], selSubs: { 1: [10] } }),
    [10, 2, 20, 21]
  );
});

test('subcabo escolhido no filtro dropdown = só ele, mesmo com árvore marcada', () => {
  assert.deepEqual(
    buildCreatedByIds({ ...base, selCabos: [1], selSubs: { 1: [11] }, subcabo: '20' }),
    [20]
  );
});

test('cabo desconhecido na seleção é ignorado', () => {
  assert.deepEqual(buildCreatedByIds({ ...base, selCabos: [99] }), []);
});