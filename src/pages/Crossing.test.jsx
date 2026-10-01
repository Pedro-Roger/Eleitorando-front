import { render, screen, within } from '@testing-library/react';
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

// Previsto vs Realizado: "Realizado" = apurado TSE (lado past) do político
// selecionado; "Previsto" = eleitores cadastrados (lado current) dele mesmo.
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

// Lista statewide do TSE (GET /elections/candidates): TODOS os candidatos do
// cargo agregados por nome. "ZEZINHO DO SERTÃO" só votou em cidades pequenas —
// não aparece em nenhuma cidade do comparativo mockado acima; só pode entrar no
// seletor via lista statewide.
const TSE_ONLY_NAME = 'ZEZINHO DO SERTÃO';
const eleicaoTSE = {
  year: 2022,
  office: 'DEPUTADO ESTADUAL',
  turn: 1,
  candidates: [
    { candidateName: TSE_NAME, party: 'PL', votes: 78456 },
    { candidateName: 'ÉLMANO XAVIER', party: 'PT', votes: 60123 },
    { candidateName: 'ANDRÉ FERNANDES', party: 'REPUBLICANOS', votes: 45789 },
    { candidateName: TSE_ONLY_NAME, party: 'AVANTE', votes: 1200 },
  ],
};

const offices = { offices: ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'] };

function mockApiAdmin({ comparativo = comparativoPendente, withOffices = true } = {}) {
  api.mockImplementation((path) => {
    if (path.startsWith('/elections/comparativo')) return Promise.resolve(comparativo);
    if (path.startsWith('/elections/candidates?')) return Promise.resolve(eleicaoTSE);
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

    // Único seletor "Político" (não há mais seletor de adversário)
    expect(await screen.findByText('Político')).toBeInTheDocument();
    expect(screen.queryByText('Adversário')).not.toBeInTheDocument();
    expect(screen.queryByText('Meu candidato')).not.toBeInTheDocument();

    // Padrão: Keiva Dias — o nome selecionado é o mesmo do TSE após normalização
    // (dedupe por nome normalizado mantém a grafia do cadastro).
    const politicoSelect = await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves');
    expect(politicoSelect.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
      .toBe(TSE_NAME.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

    // Seletor de cargo: padrão DEPUTADO ESTADUAL (onde Keiva Dias concorreu)
    expect(screen.getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.stringContaining('office=DEPUTADO%20ESTADUAL'));

    // comparativo pede TODAS as cidades (CE tem ~184 municípios)
    expect(api).toHaveBeenCalledWith(expect.stringContaining('limit=999'));
    // lista statewide pedida junto (cargo/ano/turno)
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/elections/candidates?year=2022&office=DEPUTADO%20ESTADUAL&turn=1')
    );

    // Subtítulo do cabeçalho reflete o cargo selecionado
    expect(screen.getByTestId('app-header')).toHaveTextContent('DEPUTADO ESTADUAL 2022 — 1º Turno');
    expect(screen.getByTestId('app-header')).toHaveTextContent('Resultado da eleição');

    // Card com título do cargo e ano
    expect(screen.getByText('Resultado DEPUTADO ESTADUAL 2022')).toBeInTheDocument();

    // Realizado = soma dos votos TSE dela (800+400 = 1.200)
    expect(screen.getByText('1.200')).toBeInTheDocument();
    // Previsto = base da campanha dela (140+100 = 240)
    expect(screen.getByText('240')).toBeInTheDocument();

    // Badge de meta: previsto 240 < realizado 1.200 → pendente com 20% de cobertura
    const badge = await screen.findByText(/Meta pendente/);
    expect(badge).toHaveTextContent('Meta pendente — 20% do realizado');
    expect(screen.queryByText(/Meta batida/)).not.toBeInTheDocument();

    // Card por cidade: votos dela em cada cidade
    expect(screen.getByText('Por Cidade')).toBeInTheDocument();
    expect(screen.getByText('Fortaleza')).toBeInTheDocument();
    expect(screen.getByText('Caucaia')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('como ADMIN, o seletor Político inclui candidato TSE que não aparece em nenhuma cidade do comparativo', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    // Prova que o nome só pode vir da lista statewide (/elections/candidates):
    // não está presente em nenhuma cidade do comparativo mockado
    expect(JSON.stringify(comparativoPendente)).not.toContain(TSE_ONLY_NAME);

    const politicoSelect = await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves');
    const optionNames = within(politicoSelect).getAllByRole('option').map((o) => o.textContent);
    expect(optionNames).toContain(TSE_ONLY_NAME);
    // Padrão segue o cadastro (grafia preferida sobre a do TSE)
    expect(optionNames).toContain('Keivilanny Dias Moura Gonçalves');
  });

  it('como ADMIN, mostra badge verde "Meta batida" quando previsto >= realizado', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin({ comparativo: comparativoBatida });

    render(<Crossing />);

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

    expect(await screen.findByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
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
