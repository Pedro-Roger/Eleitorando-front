// Estados e cidades oficiais via API pública do IBGE, com cache em memória
const cache = { states: null, cities: {} };

export async function fetchStates() {
  if (cache.states) return cache.states;
  const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
  const data = await res.json();
  cache.states = data.map((s) => ({ sigla: s.sigla, nome: s.nome }));
  return cache.states;
}

export async function fetchCities(uf) {
  if (!uf) return [];
  if (cache.cities[uf]) return cache.cities[uf];
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
  const data = await res.json();
  cache.cities[uf] = data.map((c) => c.nome);
  return cache.cities[uf];
}
