import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Crossing from './Crossing';
import { api, getUser } from '../lib/api';

// Mocks para isolar o teste
vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => (
    <div data-testid="app-header">{title} - {subtitle}</div>
  )
}));
vi.mock('../components/Icon', () => ({
  default: ({ name }) => <span data-testid="icon">{name}</span>
}));
vi.mock('../lib/api', () => ({
  api: vi.fn(),
  getUser: vi.fn(),
}));

// Dados realistas: candidata principal "Keiva Dias" = KEIVILANNY DIAS MOURA
// GONÇALVES (nome TSE, com Ç), DEPUTADO ESTADUAL 2022. O cadastro interno usa
// o mesmo nome; o cruzamento por nome normalizado soma os dois lados.
const TSE_NAME = 'KEIVILANNY DIAS MOURA GONÇALVES';

// Previsto vs Realizado: "Realizado" = apurado TSE (lado past) do candidato;
// "Previsto" = eleitores cadastrados (lado current). O badge compara o
// previsto do "Meu candidato" com o realizado dele mesmo.
// Pendente: 140+100 = 240 previsto vs 800+400 = 1200 realizado → 20%.
const comparativoPendente = makeComparativo({ pastKeiva: [800, 400], currentKeiva: [140, 100] });
// Batida: 1300 previsto >= 1200 realizado.
const comparativoBatida = makeComparativo({ pastKeiva: [800, 400], currentKeiva: [900, 400] });

function makeComparativo({ pastKeiva, currentKeiva }) {
  return {
    pastYear: 2022,
    office: 'DEPUTADO ESTADUAL',
    turn: 1,
    cities: [
      {
        city: 'Fortaleza',
        past: [
          { name: TSE_NAME, votes: pastKeiva[0] },
          { name: 'ÉLMANO XAVIER', votes: 800 },
          { name: 'ANDRÉ FERNANDES', votes: 300 },
        ],
        current: [
          { name: 'Keivilanny Dias Moura Gonçalves', voters: currentKeiva[0] },
          { name: 'Élmano Xavier', voters: 10 },
        ],
      },
      {
        city: 'Caucaia',
        past: [
          { name: TSE_NAME, votes: pastKeiva[1] },
          { name: 'ÉLMANO XAVIER', votes: 400 },
          { name: 'ANDRÉ FERNANDES', votes: 100 },
        ],
        current: [
          { name: 'Keivilanny Dias Moura Gonçalves', voters: currentKeiva[1] },
          { name: 'Élmano Xavier', voters: 10 },
        ],
      },
    ],
  };
}

const candidatos = {
  candidates: [
    { id: 1, name: 'Keivilanny Dias Moura Gonçalves' },
    { id: 2, name: 'Élmano Xavier' },
    { id: 3, name: 'André Fernandes' },
  ],
};

const offices = { offices: ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'] };

function mockApiAdmin({ comparativo = comparativoPendente, withOffices = true } = {}) {
  api.mockImplementation((path) => {
    if (path.startsWith('/elections/comparativo')) return Promise.resolve(comparativo);
    if (path === '/candidates') return Promise.resolve(candidatos);
    if (path === '/elections/offices') {
      return withOffices ? Promise.resolve(offices) : Promise.reject(new Error('boom'));
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
}

describe('Crossing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('como ADMIN, seleciona Keiva por padrão e mostra badge "Meta pendente" quando previsto < realizado', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    expect(await screen.findByText('Confronto Direto')).toBeInTheDocument();

    // Seletor de cargo: padrão DEPUTADO ESTADUAL (onde Keiva Dias concorreu)
    expect(screen.getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.stringContaining('office=DEPUTADO%20ESTADUAL'));

    // Padrão: "Meu candidato" = Keiva Dias — o nome selecionado é o mesmo do TSE
    // após normalização (dedupe por nome normalizado mantém a grafia do cadastro).
    const mineSelect = await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves');
    expect(mineSelect.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
      .toBe(TSE_NAME.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    // "Adversário" = primeira outra opção com votos > 0
    expect(screen.getByDisplayValue('Élmano Xavier')).toBeInTheDocument();

    // Subtítulo do cabeçalho reflete o cargo selecionado
    expect(screen.getByTestId('app-header')).toHaveTextContent('DEPUTADO ESTADUAL 2022 — 1º Turno');

    // Seções Previsto vs Realizado
    expect(screen.getByText('Realizado — apurado oficial TSE 2022 DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(screen.getByText('Previsto — base da campanha (eleitores cadastrados)')).toBeInTheDocument();

    // Realizado: Keivilanny 1.200 vs Élmano 1.200 → 50,0% (nos dois lados)
    expect(screen.getAllByText(/50\.0%/).length).toBe(2);
    // Previsto: 240 (140+100) vs 20 (10+10) → 92,3%
    expect(screen.getByText(/92\.3%/)).toBeInTheDocument();

    // Badge de meta: previsto 240 < realizado 1.200 → pendente com 20% de cobertura
    const badge = await screen.findByText(/Meta pendente/);
    expect(badge).toHaveTextContent('Meta pendente — 20% do realizado');
    // Sem badge de batida nem lógica antiga de vantagem/desvantagem
    expect(screen.queryByText(/Meta batida/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vantagem/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Desvantagem/)).not.toBeInTheDocument();

    // Card por cidade
    expect(screen.getByText('Por Cidade')).toBeInTheDocument();
    expect(screen.getByText('Fortaleza')).toBeInTheDocument();
    expect(screen.getByText('Caucaia')).toBeInTheDocument();
  });

  it('como ADMIN, mostra badge verde "Meta batida" quando previsto >= realizado', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin({ comparativo: comparativoBatida });

    render(<Crossing />);

    expect(await screen.findByText('Confronto Direto')).toBeInTheDocument();
    await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves');

    // Previsto 1.300 >= realizado 1.200 → badge verde com ícone trending_up
    const badge = await screen.findByText(/Meta batida/);
    expect(badge).toHaveTextContent('Meta batida — previsto ≥ realizado');
    expect(screen.getByTestId('icon')).toHaveTextContent('trending_up');
    expect(screen.queryByText(/Meta pendente/)).not.toBeInTheDocument();
  });

  it('como ADMIN, se /elections/offices falhar, usa os cargos padrão e mantém DEPUTADO ESTADUAL', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin({ withOffices: false });

    render(<Crossing />);

    expect(await screen.findByText('Confronto Direto')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves')).toBeInTheDocument();
    expect(screen.getByText(/Meta pendente/)).toBeInTheDocument();
  });

  it('não-admin vê mensagem de acesso restrito e a API não é chamada', () => {
    getUser.mockReturnValue({ role: 'CABO' });

    render(<Crossing />);

    expect(screen.getByText('Acesso restrito ao administrador.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
