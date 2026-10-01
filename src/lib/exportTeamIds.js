// Expande a seleção da tela de exportação (árvore cabo→subcabos) na lista final
// de ids "cadastrado por":
// - subcabo escolhido no filtro = só ele;
// - nada marcado = todos (lista vazia);
// - cabo marcado sem subcabos marcados = cabo + todos os subcabos dele;
// - cabo marcado com subcabos marcados = APENAS os subcabos marcados
//   (os eleitores do próprio cabo ficam de fora).
export function buildCreatedByIds({ cabos, selCabos, selSubs, subcabo, subcaboOptions }) {
  if (subcabo && subcaboOptions.some((s) => s.id === Number(subcabo))) return [Number(subcabo)];
  if (!cabos || selCabos.length === 0) return [];
  const ids = [];
  for (const caboId of selCabos) {
    const cabo = cabos.find((c) => c.id === caboId);
    if (!cabo) continue;
    const chosen = selSubs[caboId] || [];
    if (chosen.length === 0) ids.push(cabo.id, ...cabo.subcabos.map((s) => s.id));
    else ids.push(...chosen);
  }
  return ids;
}