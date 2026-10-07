import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Panel from './Panel';
import { api, getUser } from '../lib/api';

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => (
    <div data-testid="app-header">{title} - {subtitle}</div>
  )
}));

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  getUser: vi.fn(),
}));

const demographics = {
  byGender: [{ gender: 'Feminino', total: 60 }, { gender: 'Masculino', total: 40 }],
  byAge: [{ range: '18-24', total: 20 }],
  byZone: [{ zone: '101', total: 50 }],
};

const cidadesTse = {
  year: 2026,
  office: 'GOVERNADOR',
  turn: 1,
  cities: [
    { city: 'Fortaleza', total: 620860 },
    { city: 'Caucaia', total: 180000 },
  ],
};

// Roteia a resposta do mock pelo caminho pedido.
function mockApi({ demographics: demog = demographics, cidades = cidadesTse, rejeitaDemografico } = {}) {
  api.mockImplementation((path) => {
    if (path.startsWith('/elections/principais-cidades')) {
      return cidades === null ? Promise.reject(new Error('falha cidades')) : Promise.resolve(cidades);
    }
    if (rejeitaDemografico) return Promise.reject(new Error(rejeitaDemografico));
    return Promise.resolve(demog);
  });
}

describe('Panel Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve exibir "Carregando..." inicialmente', () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    api.mockImplementation(() => new Promise(() => {}));

    render(<Panel />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toHaveTextContent('Demográfico - Toda a campanha');
  });

  it('deve exibir erro caso a API falhe', async () => {
    getUser.mockReturnValue({ role: 'CABO' });
    mockApi({ rejeitaDemografico: 'Falha de conexão' });

    render(<Panel />);

    await waitFor(() => {
      expect(screen.getByText('Falha de conexão')).toBeInTheDocument();
    });
    expect(screen.getByTestId('app-header')).toHaveTextContent('Demográfico - Sua equipe');
  });

  it('deve renderizar os gráficos corretamente (não-admin, sem card do TSE)', async () => {
    getUser.mockReturnValue({ role: 'SUBCABO' });
    mockApi({ cidades: null });

    render(<Panel />);

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('app-header')).toHaveTextContent('Demográfico - Seus cadastros');

    expect(screen.getByText('Distribuição por Gênero')).toBeInTheDocument();
    expect(screen.getByText('Feminino')).toBeInTheDocument();

    expect(screen.getByText('Faixa Etária')).toBeInTheDocument();
    expect(screen.getByText('18-24 anos')).toBeInTheDocument();

    expect(screen.getByText('Zonas Eleitorais')).toBeInTheDocument();
    expect(screen.getByText('Zona 101')).toBeInTheDocument();

    // Card do TSE é exclusivo de ADMIN
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/dashboard/demographics');
    expect(screen.queryByText(/Votos por cidade/)).not.toBeInTheDocument();
  });

  it('como ADMIN, exibe o card de votos por cidade do TSE com a meta', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApi();

    render(<Panel />);

    expect(await screen.findByText('Votos por cidade (TSE 2026)')).toBeInTheDocument();
    expect(screen.getByText(/% da quantidade de votos/)).toBeInTheDocument();
    expect(screen.getByText('Fortaleza')).toBeInTheDocument();
  });

  it('como ADMIN, com cidades vazias o card do TSE fica oculto', async () => {
    getUser.mockReturnValue({ role: 'ADMIN' });
    mockApi({ cidades: { year: 2026, office: 'GOVERNADOR', turn: 1, cities: [] } });

    render(<Panel />);

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Distribuição por Gênero')).toBeInTheDocument();
    expect(screen.queryByText(/Votos por cidade/)).not.toBeInTheDocument();
  });
});
