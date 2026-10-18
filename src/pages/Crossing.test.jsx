import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import Crossing from './Crossing';
import { api, apiDownload } from '../lib/api';

const adminUser = vi.hoisted(() => ({ role: 'ADMIN' }));

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => <div data-testid="app-header">{title} - {subtitle}</div>,
}));

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  apiDownload: vi.fn(() => Promise.resolve()),
  getUser: vi.fn(() => adminUser),
}));

const fullReport = {
  candidateName: 'Keivia Dias',
  filters: { cabo: null, subcabo: null, city: null, neighborhood: null, zone: null, section: null },
  year: 2022,
  office: 'DEPUTADO ESTADUAL',
  turn: 1,
  cabos: [
    {
      id: 10,
      name: 'Felipe',
      prometidos: 6,
      secoes: 2,
      secoesComFaltantes: 1,
      subcabos: [
        { id: 12, name: 'João', prometidos: 4 },
        { id: 11, name: 'Pedro', prometidos: 2 },
      ],
      cidades: [
        {
          name: 'FORTALEZA',
          prometidos: 6,
          subcabos: [
            {
              id: 'JOAO',
              name: 'João',
              prometidos: 4,
              zonas: [
                {
                  name: '03',
                  prometidos: 4,
                  secoes: [
                    {
                      name: '0987',
                      prometidos: 4,
                      totalPrometidoNaSecao: 4,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 5,
                      possivelmenteVotaram: 4,
                      faltantes: 0,
                      percentualFaltantes: 0,
                      pessoas: [
                        { name: 'Eleitor 1', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                        { name: 'Eleitor 2', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                        { name: 'Eleitor 3', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                        { name: 'Eleitor 4', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'PEDRO',
              name: 'Pedro',
              prometidos: 2,
              zonas: [
                {
                  name: '02',
                  prometidos: 2,
                  secoes: [
                    {
                      name: '0533',
                      prometidos: 2,
                      totalPrometidoNaSecao: 2,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 1,
                      possivelmenteVotaram: 1,
                      faltantes: 1,
                      percentualFaltantes: 50,
                      pessoas: [
                        { name: 'Maria Silva', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
                        { name: 'José Santos', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 20,
      name: 'Maria',
      prometidos: 7,
      secoes: 1,
      secoesComFaltantes: 1,
      subcabos: [
        { id: 13, name: 'Ana', prometidos: 7 },
      ],
      cidades: [
        {
          name: 'SOBRAL',
          prometidos: 7,
          subcabos: [
            {
              id: 'ANA',
              name: 'Ana',
              prometidos: 7,
              zonas: [
                {
                  name: '04',
                  prometidos: 7,
                  secoes: [
                    {
                      name: '0123',
                      prometidos: 7,
                      totalPrometidoNaSecao: 7,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 5,
                      possivelmenteVotaram: 5,
                      faltantes: 2,
                      percentualFaltantes: 28.6,
                      pessoas: Array.from({ length: 7 }, (_, i) => ({
                        name: `Eleitor Sobral ${i + 1}`, subcabo: 'Ana', subcaboId: 13, bairro: 'CENTRO', city: 'SOBRAL', zona: '04', secao: '0123',
                      })),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  missingSections: [
    {
      cabo: 'Felipe',
      caboId: 10,
      city: 'FORTALEZA',
      zona: '02',
      secao: '0533',
      prometidos: 2,
      apuracaoDisponivel: true,
      apuradoTseNaSecao: 1,
      possivelmenteVotaram: 1,
      faltantes: 1,
      percentualFaltantes: 50,
      pessoas: [
        { name: 'Maria Silva', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
        { name: 'José Santos', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
      ],
    },
    {
      cabo: 'Maria',
      caboId: 20,
      city: 'SOBRAL',
      zona: '04',
      secao: '0123',
      prometidos: 7,
      apuracaoDisponivel: true,
      apuradoTseNaSecao: 5,
      possivelmenteVotaram: 5,
      faltantes: 2,
      percentualFaltantes: 28.6,
      pessoas: Array.from({ length: 7 }, (_, i) => ({
        name: `Eleitor Sobral ${i + 1}`, subcabo: 'Ana', subcaboId: 13, bairro: 'CENTRO', city: 'SOBRAL', zona: '04', secao: '0123',
      })),
    },
  ],
};

describe('Crossing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation((path) => {
      if (path === '/candidates') {
        return Promise.resolve({ candidates: [{ id: 1, name: 'Keivia Dias' }, { id: 2, name: 'Erika Amorim' }] });
      }
      if (path === '/dashboard/list?type=cabos') {
        return Promise.resolve({ items: [{ id: 10, title: 'Felipe' }, { id: 20, title: 'Maria' }] });
      }
      if (path === '/dashboard/list?type=subcabos') {
        return Promise.resolve({
          items: [
            { id: 11, title: 'Pedro', caboId: 10 },
            { id: 12, title: 'João', caboId: 10 },
            { id: 13, title: 'Ana', caboId: 20 },
          ],
        });
      }
      if (path.includes('/elections/inteligencia-eleitoral')) {
        const parsed = new URL(path, 'http://localhost');
        const caboId = parsed.searchParams.get('caboId');
        const subcaboId = parsed.searchParams.get('subcaboId');
        let cabos = fullReport.cabos;
        let missingSections = fullReport.missingSections;
        if (caboId) {
          cabos = cabos.filter((c) => String(c.id) === caboId);
          missingSections = missingSections.filter((m) => String(m.caboId) === caboId);
        }
        if (subcaboId === '11') {
          cabos = cabos.filter((c) => c.id === 10).map((c) => ({
            ...c,
            prometidos: 2,
            secoes: 1,
            secoesComFaltantes: 1,
            subcabos: [{ id: 11, name: 'Pedro', prometidos: 2 }],
            cidades: c.cidades.map((city) => ({
              ...city,
              prometidos: 2,
              subcabos: city.subcabos.filter((s) => s.name === 'Pedro'),
            })),
          }));
          missingSections = missingSections.filter((m) => m.secao === '0533');
        }
        return Promise.resolve({ ...fullReport, cabos, missingSections });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exibe o quadro-resumo com o total geral ao selecionar uma candidata sem filtros', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    const summaryRegion = await screen.findByRole('region', { name: 'Resumo dos filtros' });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('13');
    expect(within(summaryRegion).getByTestId('filter-total-apurados')).toHaveTextContent('11');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes')).toHaveTextContent('3');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes').closest('.election-metric-missing')).toBeInTheDocument();
  });

  it('atualiza na hora o quadro-resumo ao escolher um cabo e um subcabo nos filtros', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    // Escolhe o Cabo Felipe (id 10): prometidos = 6, apurados = 6 (5 + 1), faltantes = 1
    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    expect(screen.getByTestId('filter-total-prometidos')).toHaveTextContent('6');
    expect(screen.getByTestId('filter-total-apurados')).toHaveTextContent('6');
    expect(screen.getByTestId('filter-total-faltantes')).toHaveTextContent('1');

    // Escolhe o Subcabo Pedro (id 11): prometidos = 2, apurados = 1, faltantes = 1
    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '11' } });
    expect(screen.getByTestId('filter-total-prometidos')).toHaveTextContent('2');
    expect(screen.getByTestId('filter-total-apurados')).toHaveTextContent('1');
    expect(screen.getByTestId('filter-total-faltantes')).toHaveTextContent('1');

    // Escolhe o Subcabo João (id 12): prometidos = 4, apurados = 5, faltantes = 0
    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '12' } });
    expect(screen.getByTestId('filter-total-prometidos')).toHaveTextContent('4');
    expect(screen.getByTestId('filter-total-apurados')).toHaveTextContent('5');
    expect(screen.getByTestId('filter-total-faltantes')).toHaveTextContent('0');
  });

  it('mostra apenas os subcabos vinculados ao cabo selecionado', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    const subcaboFilter = screen.getByLabelText('Subcabo');
    expect(within(subcaboFilter).getByRole('option', { name: 'Pedro' })).toBeInTheDocument();
    expect(within(subcaboFilter).getByRole('option', { name: 'João' })).toBeInTheDocument();
    expect(within(subcaboFilter).queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument();
  });

  it('envia os filtros aplicados aos downloads de PDF', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Fortaleza' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: '02' } });
    fireEvent.change(screen.getByLabelText('Seção'), { target: { value: '0533' } });

    fireEvent.click(await screen.findByRole('button', { name: 'Baixar PDF de possíveis não votantes' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/elections/inteligencia-eleitoral/eleitores/pdf?'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('city=Fortaleza'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('zone=02'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('section=0533'));

    fireEvent.click(screen.getByRole('button', { name: 'Baixar PDF do resumo' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/elections/inteligencia-eleitoral/resumo-cabos/pdf?'));
  });

  it('mostra mensagem vazia quando a candidata não possui registros', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidates') return Promise.resolve({ candidates: [{ id: 1, name: 'Keivia Dias' }] });
      if (path === '/dashboard/list?type=cabos' || path === '/dashboard/list?type=subcabos') return Promise.resolve({ items: [] });
      if (path.includes('/elections/inteligencia-eleitoral')) return Promise.resolve({ cabos: [], missingSections: [] });
      return Promise.reject(new Error('unexpected path'));
    });

    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    expect(await screen.findByText('Nenhuma seção com diferença numérica para os filtros.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum cadastro para os filtros.')).toBeInTheDocument();
  });
});
