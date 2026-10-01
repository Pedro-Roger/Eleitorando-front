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

const comparativo = {
  pastYear: 2022,
  office: 'DEPUTADO ESTADUAL',
  turn: 1,
  cities: [
    {
      city: 'Fortaleza',
      past: [
        { name: TSE_NAME, votes: 1200 },
        { name: 'ÉLMANO XAVIER', votes: 800 },
        { name: 'ANDRÉ FERNANDES', votes: 300 },
      ],
      current: [
        { name: 'Keivilanny Dias Moura Gonçalves', voters: 30 },
        { name: 'Élmano Xavier', voters: 10 },
      ],
    },
    {
      city: 'Caucaia',
      past: [
        { name: TSE_NAME, votes: 500 },
        { name: 'ÉLMANO XAVIER', votes: 400 },
        { name: 'ANDRÉ FERNANDES', votes: 100 },
      ],
      current: [
        { name: 'Keivilanny Dias Moura Gonçalves', voters: 20 },
        { name: 'Élmano Xavier', voters: 10 },
      ],
    },
  ],
};

const candidatos = {
  candidates: [
    { id: 1, name: 'Keivilanny Dias Moura Gonçalves' },
    { id: 2, name: 'Élmano Xavier' },
    { id: 3, name: 'André Fernandes' },
  ],
};

const offices = { offices: ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'] };

function mockApiAdmin({ withOffices = true } = {}) {
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

  it('como ADMIN, carrega dados, seleciona Keiva (nome TSE) por padrão e mostra Vantagem', async () => {
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

    // Seções (meta reflete o cargo selecionado)
    expect(screen.getByText('Votos TSE 2022 — DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(screen.getByText('Intenção de Voto (cadastrados)')).toBeInTheDocument();

    // TSE: Keivilanny 1700 (1200+500) vs Élmano 1200 (800+400) → 58,6% / 41,4%
    expect(screen.getByText(/58\.6%/)).toBeInTheDocument();
    expect(screen.getByText(/41\.4%/)).toBeInTheDocument();

    // Intenção: 50 (30+20) vs 20 (10+10) → 71,4%
    expect(screen.getByText(/71\.4%/)).toBeInTheDocument();

    // Badge verde de vantagem (Keiva à frente) nos dois confrontos, sem badge de desvantagem
    expect(screen.getAllByText(/Vantagem/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Desvantagem/)).not.toBeInTheDocument();

    // Card por cidade
    expect(screen.getByText('Por Cidade')).toBeInTheDocument();
    expect(screen.getByText('Fortaleza')).toBeInTheDocument();
    expect(screen.getByText('Caucaia')).toBeInTheDocument();
  });

  it('como ADMIN, se /elections/offices falhar, usa os cargos padrão e mantém DEPUTADO ESTADUAL', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin({ withOffices: false });

    render(<Crossing />);

    expect(await screen.findByText('Confronto Direto')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Keivilanny Dias Moura Gonçalves')).toBeInTheDocument();
    expect(screen.getAllByText(/Vantagem/).length).toBeGreaterThan(0);
  });

  it('não-admin vê mensagem de acesso restrito e a API não é chamada', () => {
    getUser.mockReturnValue({ role: 'CABO' });

    render(<Crossing />);

    expect(screen.getByText('Acesso restrito ao administrador.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
