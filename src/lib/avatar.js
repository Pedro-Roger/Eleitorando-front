// Cor determinística de avatar a partir de um texto (nome/usuário),
// para diferenciar visualmente os cartões de uma lista.
const PALETTE = ['var(--primary)', 'var(--tertiary)', 'var(--success)', '#7c3aed', 'var(--secondary)', '#c2410c'];

export function avatarColor(seed) {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
