import { render, screen, within, fireEvent } from '@testing-library/react';
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

// Dados realistas. Slot A: candidata principal "Keiva Dias" = KEIVILANNY DIAS
// MOURA GONÇALVES (nome TSE, com Ç), DEPUTADO ESTADUAL 2022 — 29.844 votos.
// Slot B (padrão, mesmo cargo): o outro com mais votos = ÉLMANO XAVIER —
// 44.766 = 1,5x Keiva, delta = +14.922 votos (+50%).
const TSE_NAME = 'KEIVILANNY DIAS MOURA GONÇALVES';
const KEIVA_TSE = 29844;
const ELMANO_DEP_TSE = 44766;
const ANDRE_DEP_TSE = 12000;
const ELMANO_GOVT_TSE = 615011;
const ANDRE_GOVT_TSE = 290000;

// Sem cadastro interno: "ZEZINHO DO SERTÃO" só existe na base TSE — não há
// linha Candidate para ele, logo sem base por bairro.
const TSE_ONLY_NAME = 'ZEZINHO DO SERTÃO';

const registered = {
  candidates: [
    { id: 1, name: 'Keivilanny Dias Moura Gonçalves' },
    { id: 2, name: 'Élmano Xavier' },
  ],
};

const offices = { offices: ['DEPUTADO ESTADUAL', 'GOVERNADOR', 'DEPUTADO FEDERAL', 'SENADOR'] };

// Lista statewide do TSE por cargo (GET /elections/candidates).
const tseDep = {
  year: 2022,
  office: 'DEPUTADO ESTADUAL',
  turn: 1,
  candidates: [
    { candidateName: 'ÉLMANO XAVIER', party: 'PT', votes: ELMANO_DEP_TSE },
    { candidateName: TSE_NAME, party: 'PL', votes: KEIVA_TSE },
    { candidateName: 'ANDRÉ FERNANDES', party: 'REPUBLICANOS', votes: ANDRE_DEP_TSE },
    { candidateName: TSE_ONLY_NAME, party: 'AVANTE', votes: 800 },
  ],
};

const tseGov = {
  year: 2022,
  office: 'GOVERNADOR',
  turn: 1,
  candidates: [
    { candidateName: 'ELMANO XAVIER', party: 'PT', votes: ELMANO_GOVT_TSE },
    { candidateName: 'ANDRÉ FERNANDES', party: 'REPUBLICANOS', votes: ANDRE_GOVT_TSE },
  ],
};

// Comparativo por cidade (lado past = TSE; lado current = eleitores cadastrados
// via voters join candidates). Soma por cidade bate com o statewide.
// Coletado padrão: Keiva 140+100 = 240; Élmano 400+200 = 600.
function comparativoDep(currentKeiva = [140, 100]) {
  return {
    pastYear: 2022,
    office: 'DEPUTADO ESTADUAL',
    turn: 1,
    cities: [
      {
        city: 'Fortaleza',
        past: [
          { name: TSE_NAME, votes: 18000 },
          { name: 'ÉLMANO XAVIER', votes: 26000 },
        ],
        current: [
          { name: 'Keivilanny Dias Moura Gonçalves', voters: currentKeiva[0] },
          { name: 'Élmano Xavier', voters: 400 },
        ],
      },
      {
        city: 'Caucaia',
        past: [
          { name: TSE_NAME, votes: 11844 },
          { name: 'ÉLMANO XAVIER', votes: 18766 },
        ],
        current: [
          { name: 'Keivilanny Dias Moura Gonçalves', voters: currentKeiva[1] },
          { name: 'Élmano Xavier', voters: 200 },
        ],
      },
    ],
  };
}

const comparativoGov = {
  pastYear: 2022,
  office: 'GOVERNADOR',
  turn: 1,
  cities: [
    {
      city: 'Fortaleza',
      past: [{ name: 'ELMANO XAVIER', votes: 400000 }],
      current: [{ name: 'Élmano Xavier', voters: 300 }],
    },
  ],
};

// Base por bairro (GET /elections/base-bairros?candidateId=N).
const bairrosKeiva = {
  candidateId: 1,
  bairros: [
    { neighborhood: 'Centro', total: 80 },
    { neighborhood: 'Maraponga', total: 60 },
  ],
};
const bairrosElmano = {
  candidateId: 2,
  bairros: [{ neighborhood: 'Centro', total: 150 }],
};

function mockApiAdmin({ currentKeiva = [140, 100] } = {}) {
  api.mockImplementation((path) => {
    if (path.startsWith('/elections/comparativo')) {
      if (path.includes('office=DEPUTADO%20ESTADUAL')) return Promise.resolve(comparativoDep(currentKeiva));
      if (path.includes('office=GOVERNADOR')) return Promise.resolve(comparativoGov);
      return Promise.reject(new Error(`rota inesperada: ${path}`));
    }
    if (path.startsWith('/elections/candidates?')) {
      if (path.includes('office=DEPUTADO%20ESTADUAL')) return Promise.resolve(tseDep);
      if (path.includes('office=GOVERNADOR')) return Promise.resolve(tseGov);
      return Promise.reject(new Error(`rota inesperada: ${path}`));
    }
    if (path === '/candidates') return Promise.resolve(registered);
    if (path === '/elections/offices') return Promise.resolve(offices);
    if (path.startsWith('/elections/base-bairros')) {
      if (path.includes('candidateId=1')) return Promise.resolve(bairrosKeiva);
      if (path.includes('candidateId=2')) return Promise.resolve(bairrosElmano);
      return Promise.resolve({ candidateId: null, bairros: [] });
    }
    return Promise.reject(new Error(`rota inesperada: ${path}`));
  });
}

describe('Crossing Page — Inteligência Eleitoral (comparativo A vs B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('como ADMIN, monta os dois slots com padrão Keiva (A) e o outro com mais votos (B) e mostra o delta', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    // Cabeçalho da página
    const header = await screen.findByTestId('app-header');
    expect(header).toHaveTextContent('Inteligência Eleitoral');
    expect(header).toHaveTextContent('TSE 2022 — comparativo');

    // Dois slots independentes (cargo + político em cada)
    const slotA = screen.getByTestId('slot-a');
    const slotB = screen.getByTestId('slot-b');
    expect(within(slotA).getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();
    expect(within(slotB).getByDisplayValue('DEPUTADO ESTADUAL')).toBeInTheDocument();

    // Padrão A: Keiva via cascata (nome do cadastro, mesma grafia do TSE normalizada)
    expect(await within(slotA).findByDisplayValue('Keivilanny Dias Moura Gonçalves')).toBeInTheDocument();
    // Padrão B: o OUTRO político com mais votos no mesmo cargo (Élmano, 44.766 > André 12.000)
    expect(await within(slotB).findByDisplayValue('Élmano Xavier')).toBeInTheDocument();

    // comparativo pede TODAS as cidades (CE tem ~184 municípios)
    expect(api).toHaveBeenCalledWith(expect.stringContaining('limit=999'));
    expect(api).toHaveBeenCalledWith(expect.stringContaining('office=DEPUTADO%20ESTADUAL'));
    // base por bairro buscada por candidateId da linha cadastrada
    expect(api).toHaveBeenCalledWith('/elections/base-bairros?candidateId=1');
    expect(api).toHaveBeenCalledWith('/elections/base-bairros?candidateId=2');

    // Totais apurados lado a lado: Keiva 29.844 vs Élmano 44.766
    const totais = screen.getByTestId('totais');
    expect(within(totais).getByText('29.844')).toBeInTheDocument();
    expect(within(totais).getByText('44.766')).toBeInTheDocument();
    // Delta absoluto e percentual: 44.766 - 29.844 = 14.922; 14.922/29.844 = 50%
    const delta = screen.getByTestId('delta');
    expect(delta).toHaveTextContent('tem 14.922 votos a mais que');
    expect(delta).toHaveTextContent('(+50%)');
  });

  it('como ADMIN, mostra Obtido vs Coletado com MetaBadge pendente em cada slot', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin({ currentKeiva: [140, 100] });

    render(<Crossing />);

    const cardA = await screen.findByTestId('obtido-coletado-a');
    const cardB = await screen.findByTestId('obtido-coletado-b');

    // Slot A: obtido 29.844 (TSE) vs coletado 240 (cadastro) → 0,8% de cobertura
    expect(within(cardA).getByText('Obtido vs Coletado — Keivilanny Dias Moura Gonçalves')).toBeInTheDocument();
    expect(within(cardA).getByText('29.844')).toBeInTheDocument();
    expect(within(cardA).getByText('240')).toBeInTheDocument();
    expect(within(cardA).getByText(/Meta pendente/)).toHaveTextContent('Meta pendente — 0,8% do realizado');

    // Slot B: obtido 44.766 vs coletado 600
    expect(within(cardB).getByText('Obtido vs Coletado — Élmano Xavier')).toBeInTheDocument();
    expect(within(cardB).getByText('44.766')).toBeInTheDocument();
    expect(within(cardB).getByText('600')).toBeInTheDocument();
    expect(within(cardB).getByText(/Meta pendente/)).toBeInTheDocument();
  });

  it('como ADMIN, mostra badge verde "Meta batida" quando coletado >= obtido', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    // Coletado 21.000+10.000 = 31.000 >= obtido 29.844
    mockApiAdmin({ currentKeiva: [21000, 10000] });

    render(<Crossing />);

    const cardA = await screen.findByTestId('obtido-coletado-a');
    expect(within(cardA).getByText(/Meta batida/)).toHaveTextContent('Meta batida — previsto ≥ realizado');
    expect(within(cardA).getByTestId('icon')).toHaveTextContent('trending_up');
    expect(within(cardA).getByText('31.000')).toBeInTheDocument();
    // Slot B continua pendente (600 < 44.766)
    const cardB = await screen.findByTestId('obtido-coletado-b');
    expect(within(cardB).getByText(/Meta pendente/)).toBeInTheDocument();
  });

  it('como ADMIN, renderiza eleitores por bairro de cada slot', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    const bairrosA = await screen.findByTestId('bairros-a');
    expect(within(bairrosA).getByText(`Bairros — Keivilanny Dias Moura Gonçalves`)).toBeInTheDocument();
    // Espera a resposta de /elections/base-bairros carregar as barras
    expect(await within(bairrosA).findByText('Centro')).toBeInTheDocument();
    expect(within(bairrosA).getByText('80')).toBeInTheDocument();
    expect(within(bairrosA).getByText('Maraponga')).toBeInTheDocument();
    expect(within(bairrosA).getByText('60')).toBeInTheDocument();

    const bairrosB = screen.getByTestId('bairros-b');
    expect(within(bairrosB).getByText('Bairros — Élmano Xavier')).toBeInTheDocument();
    expect(await within(bairrosB).findByText('150')).toBeInTheDocument();
  });

  it('como ADMIN, mudar o cargo do slot B refaz as buscas e aplica o padrão do novo cargo (comparativo entre cargos)', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    await screen.findByTestId('bairros-a');
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining('office=GOVERNADOR'));

    // Slot B passa a GOVERNADOR: governador vs deputada estadual
    const slotB = screen.getByTestId('slot-b');
    fireEvent.change(within(slotB).getByDisplayValue('DEPUTADO ESTADUAL'), { target: { value: 'GOVERNADOR' } });

    // Refetch do cargo novo (comparativo + statewide), com limit=999.
    // Durante o recarregamento os slots desmontam ("Carregando..."), então
    // re-consulta o slot B depois.
    expect(api).toHaveBeenCalledWith(expect.stringContaining('/elections/comparativo?pastYear=2022&office=GOVERNADOR'));
    expect(api).toHaveBeenCalledWith(expect.stringContaining('/elections/candidates?year=2022&office=GOVERNADOR&turn=1'));

    // Padrão do novo cargo: Élmano (615.011, o outro com mais votos — Keiva não concorreu a governador)
    const slotBReloaded = await screen.findByTestId('slot-b');
    expect(await within(slotBReloaded).findByDisplayValue('Élmano Xavier')).toBeInTheDocument();

    // Delta entre cargos: 615.011 - 29.844 = 585.167; base = 29.844 (o menor)
    const diff = ELMANO_GOVT_TSE - KEIVA_TSE;
    const pct = Math.round((diff / KEIVA_TSE) * 1000) / 10;
    const delta = screen.getByTestId('delta');
    expect(delta).toHaveTextContent(`tem ${diff.toLocaleString('pt-BR')} votos a mais que`);
    expect(delta).toHaveTextContent(`(+${pct.toLocaleString('pt-BR')}%)`);
  });

  it('como ADMIN, político só presente na base TSE mostra "Sem base cadastrada" e não busca bairros', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApiAdmin();

    render(<Crossing />);

    const slotB = await screen.findByTestId('slot-b');
    // "ZEZINHO DO SERTÃO" só existe na lista statewide do TSE (sem linha Candidate)
    expect(JSON.stringify(comparativoDep())).not.toContain(TSE_ONLY_NAME);
    // Aguarda o padrão B (Élmano) estar aplicado antes de trocar o político
    const politicoB = await within(slotB).findByDisplayValue('Élmano Xavier');
    fireEvent.change(politicoB, { target: { value: TSE_ONLY_NAME } });

    const bairrosB = await screen.findByTestId('bairros-b');
    expect(within(bairrosB).getByText('Sem base cadastrada para este político.')).toBeInTheDocument();
    // Nenhuma busca de bairros além dos dois candidatos cadastrados (ids 1 e 2)
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining('base-bairros?candidateId=3'));
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining('candidateName='));
  });

  it('não-admin vê mensagem de acesso restrito e a API não é chamada', () => {
    getUser.mockReturnValue({ role: 'CABO' });

    render(<Crossing />);

    expect(screen.getByText('Acesso restrito ao administrador.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});