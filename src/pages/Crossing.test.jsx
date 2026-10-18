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
  prometidos: 15,
  entregue: 8,
  faltante: 3,
  excedente: 2,
  compartilhadas: 1,
  prometidosCompartilhados: 4,
  prometidosSemApuracao: 0,
  cobertura: 8 / 15,
  cabos: [
    {
      id: 10,
      name: 'Felipe',
      prometidos: 8,
      entregue: 3,
      faltante: 1,
      excedente: 2,
      compartilhadas: 1,
      prometidosCompartilhados: 4,
      prometidosSemApuracao: 0,
      cobertura: 0.375,
      secoes: 2,
      secoesComFaltantes: 1,
      subcabos: [
        { id: 12, name: 'João', prometidos: 5, secoes: 2, compartilhadas: 1 },
        { id: 11, name: 'Pedro', prometidos: 3, secoes: 2, compartilhadas: 1 },
      ],
      cidades: [
        {
          name: 'FORTALEZA',
          prometidos: 8,
          entregue: 3,
          faltante: 1,
          excedente: 2,
          compartilhadas: 1,
          prometidosCompartilhados: 4,
          prometidosSemApuracao: 0,
          cobertura: 0.375,
          bairros: [
            {
              name: 'ALDEOTA',
              prometidos: 2,
              entregue: 1,
              faltante: 1,
              excedente: 0,
              compartilhadas: 0,
              prometidosCompartilhados: 0,
              prometidosSemApuracao: 0,
              cobertura: 0.5,
            },
            {
              name: 'CENTRO',
              prometidos: 6,
              entregue: 2,
              faltante: 0,
              excedente: 2,
              compartilhadas: 1,
              prometidosCompartilhados: 4,
              prometidosSemApuracao: 0,
              cobertura: 2 / 6,
            },
          ],
          subcabos: [
            {
              id: 12,
              name: 'João',
              prometidos: 5,
              zonas: [
                {
                  name: '03',
                  prometidos: 5,
                  secoes: [
                    {
                      name: '0987',
                      prometidos: 2,
                      totalPrometidoNaSecao: 2,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 4,
                      entregue: 2,
                      faltante: 0,
                      excedente: 2,
                      compartilhada: false,
                      cobertura: 1,
                      percentualFaltantes: 0,
                      pessoas: [
                        { name: 'Eleitor 1', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                        { name: 'Eleitor 2', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0987' },
                      ],
                    },
                    {
                      name: '0999',
                      prometidos: 3,
                      totalPrometidoNaSecao: 4,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 10,
                      entregue: 4,
                      faltante: 0,
                      excedente: 6,
                      compartilhada: true,
                      cobertura: 1,
                      percentualFaltantes: 0,
                      pessoas: [
                        { name: 'Eleitor 3', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0999' },
                        { name: 'Eleitor 4', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0999' },
                        { name: 'Eleitor 5', subcabo: 'João', subcaboId: 12, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0999' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 11,
              name: 'Pedro',
              prometidos: 3,
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
                      entregue: 1,
                      faltante: 1,
                      excedente: 0,
                      compartilhada: false,
                      cobertura: 0.5,
                      percentualFaltantes: 50,
                      pessoas: [
                        { name: 'Maria Silva', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
                        { name: 'José Santos', subcabo: 'Pedro', subcaboId: 11, bairro: 'ALDEOTA', city: 'FORTALEZA', zona: '02', secao: '0533' },
                      ],
                    },
                  ],
                },
                {
                  name: '03',
                  prometidos: 1,
                  secoes: [
                    {
                      name: '0999',
                      prometidos: 1,
                      totalPrometidoNaSecao: 4,
                      apuracaoDisponivel: true,
                      apuradoTseNaSecao: 10,
                      entregue: 4,
                      faltante: 0,
                      excedente: 6,
                      compartilhada: true,
                      cobertura: 1,
                      percentualFaltantes: 0,
                      pessoas: [
                        { name: 'Pedro Comp', subcabo: 'Pedro', subcaboId: 11, bairro: 'CENTRO', city: 'FORTALEZA', zona: '03', secao: '0999' },
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
      entregue: 5,
      faltante: 2,
      excedente: 0,
      compartilhadas: 0,
      prometidosCompartilhados: 0,
      prometidosSemApuracao: 0,
      cobertura: 5 / 7,
      secoes: 1,
      secoesComFaltantes: 1,
      subcabos: [
        { id: 13, name: 'Ana', prometidos: 7, secoes: 1, compartilhadas: 0 },
      ],
      cidades: [
        {
          name: 'SOBRAL',
          prometidos: 7,
          entregue: 5,
          faltante: 2,
          excedente: 0,
          compartilhadas: 0,
          prometidosCompartilhados: 0,
          prometidosSemApuracao: 0,
          cobertura: 5 / 7,
          bairros: [
            {
              name: 'DOM EXPEDITO',
              prometidos: 7,
              entregue: 5,
              faltante: 2,
              excedente: 0,
              compartilhadas: 0,
              prometidosCompartilhados: 0,
              prometidosSemApuracao: 0,
              cobertura: 5 / 7,
            },
          ],
          subcabos: [
            {
              id: 13,
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
                      entregue: 5,
                      faltante: 2,
                      excedente: 0,
                      compartilhada: false,
                      cobertura: 5 / 7,
                      percentualFaltantes: 28.6,
                      pessoas: Array.from({ length: 7 }, (_, i) => ({
                        name: `Eleitor Sobral ${i + 1}`, subcabo: 'Ana', subcaboId: 13, bairro: 'DOM EXPEDITO', city: 'SOBRAL', zona: '04', secao: '0123',
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
      entregue: 1,
      faltante: 1,
      excedente: 0,
      compartilhada: false,
      cobertura: 0.5,
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
      entregue: 5,
      faltante: 2,
      excedente: 0,
      compartilhada: false,
      cobertura: 5 / 7,
      percentualFaltantes: 28.6,
      pessoas: Array.from({ length: 7 }, (_, i) => ({
        name: `Eleitor Sobral ${i + 1}`, subcabo: 'Ana', subcaboId: 13, bairro: 'DOM EXPEDITO', city: 'SOBRAL', zona: '04', secao: '0123',
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
        return Promise.resolve(fullReport);
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exibe os cartões com prometidos, entregue, faltante e cobertura do payload geral e os rótulos da seção', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    const summaryRegion = await screen.findByRole('region', { name: 'Resumo dos filtros' });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('15');
    expect(within(summaryRegion).getByTestId('filter-total-entregue')).toHaveTextContent('8');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes')).toHaveTextContent('3');
    expect(within(summaryRegion).getByTestId('filter-total-cobertura')).toHaveTextContent('53,3%');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes').closest('.election-metric-missing')).toBeInTheDocument();

    expect((await screen.findAllByText('Entregue (TSE)')).length).toBeGreaterThan(0);
    expect(screen.getByText('Faltante · 50,0%')).toBeInTheDocument();
  });

  it('lê entregue, faltante, prometidos e cobertura do cabo sem recalcular no front', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    // Cabo Felipe (id 10): prometidos = 8, entregue = 3 (seção compartilhada não entra), faltante = 1, cobertura = 37,5%
    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    const summaryRegion = screen.getByRole('region', { name: 'Resumo dos filtros' });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('8');
    expect(within(summaryRegion).getByTestId('filter-total-entregue')).toHaveTextContent('3');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes')).toHaveTextContent('1');
    expect(within(summaryRegion).getByTestId('filter-total-cobertura')).toHaveTextContent('37,5%');
  });

  it('mostra apenas prometidos e seções exclusivas no filtro de subcabo, sem entregue', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '11' } });

    const summaryRegion = screen.getByRole('region', { name: 'Resumo dos filtros' });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('3');
    expect(within(summaryRegion).getByTestId('filter-total-secoes-exclusivas')).toHaveTextContent('1');
    expect(within(summaryRegion).queryByTestId('filter-total-entregue')).not.toBeInTheDocument();
    expect(within(summaryRegion).queryByTestId('filter-total-faltantes')).not.toBeInTheDocument();

    // Troca para Subcabo João (id 12) na hora, sem clique
    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '12' } });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('5');
    expect(within(summaryRegion).getByTestId('filter-total-secoes-exclusivas')).toHaveTextContent('1');
  });

  it('lê entregue, faltante, prometidos e cobertura do payload ao filtrar por cidade e bairro', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Sobral' } });
    const summaryRegion = screen.getByRole('region', { name: 'Resumo dos filtros' });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('7');
    expect(within(summaryRegion).getByTestId('filter-total-entregue')).toHaveTextContent('5');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes')).toHaveTextContent('2');
    expect(within(summaryRegion).getByTestId('filter-total-cobertura')).toHaveTextContent('71,4%');

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Fortaleza' } });
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Aldeota' } });
    expect(within(summaryRegion).getByTestId('filter-total-prometidos')).toHaveTextContent('2');
    expect(within(summaryRegion).getByTestId('filter-total-entregue')).toHaveTextContent('1');
    expect(within(summaryRegion).getByTestId('filter-total-faltantes')).toHaveTextContent('1');
    expect(within(summaryRegion).getByTestId('filter-total-cobertura')).toHaveTextContent('50,0%');
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

  it('habilita os botões de download conforme os filtros e chama as URLs corretas com parâmetros', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByText('Resumo por cabo e subcabo');

    const btnGeral = screen.getByRole('button', { name: 'Baixar relatório geral' });
    const btnCabo = screen.getByRole('button', { name: 'Baixar relatório por cabo' });
    const btnSubcabo = screen.getByRole('button', { name: 'Baixar relatório por subcabo' });

    expect(btnGeral).toBeEnabled();
    expect(btnCabo).toBeDisabled();
    expect(btnSubcabo).toBeDisabled();
    expect(screen.getByText(/Selecione um cabo nos filtros para habilitar o relatório por cabo/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Fortaleza' } });
    await screen.findByRole('button', { name: 'Baixar relatório geral' });

    fireEvent.click(screen.getByRole('button', { name: 'Baixar relatório geral' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/elections/inteligencia-eleitoral/relatorio-geral/pdf?'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('city=Fortaleza'));

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar relatório por cabo' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Baixar relatório por subcabo' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Baixar relatório por cabo' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/elections/inteligencia-eleitoral/relatorio-cabo/pdf?'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('caboId=10'));

    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '11' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar relatório por subcabo' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Baixar relatório por subcabo' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/elections/inteligencia-eleitoral/relatorio-subcabo/pdf?'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('subcaboId=11'));
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
