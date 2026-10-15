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

const rows = [
  {
    city: 'FORTALEZA', cabo: 'Felipe', subcabo: 'Pedro', zona: '02', secao: '0533',
    cadastrados: 2, apurado: 3, diferenca: -1, status: 'OK',
  },
  {
    city: 'FORTALEZA', cabo: 'Felipe', subcabo: 'João', zona: '03', secao: '0987',
    cadastrados: 4, apurado: 5, diferenca: -1, status: 'OK',
  },
  {
    city: 'SOBRAL', cabo: 'Neudo', subcabo: '', zona: '04', secao: '0123',
    cadastrados: 7, apurado: 7, diferenca: 0, status: 'OK',
  },
];

describe('Crossing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation((path) => {
      if (path === '/candidates') {
        return Promise.resolve({ candidates: [{ id: 1, name: 'Keivia Dias' }, { id: 2, name: 'Erika Amorim' }] });
      }
      if (path === '/dashboard/list?type=cabos') return Promise.resolve({ items: [{ id: 10, title: 'Felipe' }, { id: 20, title: 'Maria' }] });
      if (path === '/dashboard/list?type=subcabos') {
        return Promise.resolve({ items: [
          { id: 11, title: 'Pedro', caboId: 10 },
          { id: 12, title: 'João', caboId: 10 },
          { id: 13, title: 'Ana', caboId: 20 },
        ] });
      }
      if (path.includes('/elections/comparativo-eleitores')) {
        const parsed = new URL(path, 'http://localhost');
        const filtered = parsed.searchParams.get('caboId') === '10'
          ? rows.filter((row) => row.cabo === 'Felipe')
          : parsed.searchParams.get('subcaboId') === '11'
            ? rows.filter((row) => row.subcabo === 'Pedro')
            : rows;
        return Promise.resolve({ rows: filtered });
      }
      if (path.includes('/elections/relatorio-faltantes')) return Promise.resolve({
        candidateName: 'Keivia Dias',
        summary: [{ cabo: 'Felipe', subcabo: 'Pedro', cadastrados: 2, secoes: 1, secoesComFaltantes: 1 }],
        missing: [{ city: 'FORTALEZA', zona: '02', secao: '0533', cadastrados: 4, apurado: 3, faltantes: 1, teams: [{ cabo: 'Felipe', subcabo: 'Pedro' }] }],
        totalCadastrados: 6,
        totalApurado: 12,
        totalFaltantes: 1,
      });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exibe os agrupamentos cadastrados e o apurado TSE após escolher candidata', async () => {
    render(<Crossing />);

    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    expect(await screen.findByText('Carregando comparação...')).toBeInTheDocument();
    expect((await screen.findAllByRole('columnheader', { name: 'Votos cadastrados' }))[0]).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Apurado TSE' })[0]).toBeInTheDocument();
    const table = screen.getAllByRole('table')[0];
    expect(within(table).getByText('Pedro')).toBeInTheDocument();
    expect(within(table).getByText('0533')).toBeInTheDocument();
    expect(within(table).getByText('2')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('filtra a tabela por subcabo e zona sem remover os demais filtros', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findAllByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '11' } });
    await waitFor(() => expect(screen.getAllByRole('table').length).toBeGreaterThan(0));
    expect(within(screen.getAllByRole('table')[0]).getByText('Pedro')).toBeInTheDocument();
    expect(within(screen.getAllByRole('table')[0]).queryByText('João')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: '03' } });
    await waitFor(() => {
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
      expect(within(screen.getAllByRole('table')[0]).queryByText('Pedro')).not.toBeInTheDocument();
      expect(within(screen.getAllByRole('table')[0]).getByText('João')).toBeInTheDocument();
    });
  });

  it('mostra apenas os subcabos vinculados ao cabo selecionado', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findAllByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    const subcaboFilter = screen.getByLabelText('Subcabo');
    expect(within(subcaboFilter).getByRole('option', { name: 'Pedro' })).toBeInTheDocument();
    expect(within(subcaboFilter).getByRole('option', { name: 'João' })).toBeInTheDocument();
    expect(within(subcaboFilter).queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument();
  });

  it('filtra por cidade e envia cidade, zona e seção aos PDFs', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findAllByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Fortaleza' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: '02' } });
    fireEvent.change(screen.getByLabelText('Seção'), { target: { value: '0533' } });
    await waitFor(() => expect(screen.getAllByRole('table').length).toBeGreaterThan(0));
    expect(within(screen.getAllByRole('table')[0]).getByText('FORTALEZA')).toBeInTheDocument();
    expect(within(screen.getAllByRole('table')[0]).queryByText('SOBRAL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'PDF eleitores detalhado' }));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('city=Fortaleza'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('zone=02'));
    expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('section=0533'));
  });

  it('aplica todos os filtros também ao resumo e informa o total oficial apurado', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findAllByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Fortaleza' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: '02' } });
    fireEvent.change(screen.getByLabelText('Seção'), { target: { value: '0533' } });

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(expect.stringMatching(/\/elections\/relatorio-faltantes\?.*city=Fortaleza.*zone=02.*section=0533/));
    });
    expect((await screen.findAllByText('Apurado TSE')).length).toBeGreaterThan(1);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('filtra somente os cadastros do cabo selecionado e envia o cabo para a API', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findAllByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(expect.stringContaining('caboId=10'));
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    });
    const comparisonTable = screen.getAllByRole('table')[0];
    expect(within(comparisonTable).getAllByText('Felipe')).not.toHaveLength(0);
    expect(within(comparisonTable).queryByText('Neudo')).not.toBeInTheDocument();
  });

  it('mostra mensagem vazia quando a candidata não possui linhas', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidates') return Promise.resolve({ candidates: [{ id: 1, name: 'Keivia Dias' }] });
      if (path === '/dashboard/list?type=cabos' || path === '/dashboard/list?type=subcabos') return Promise.resolve({ items: [] });
      if (path.includes('/elections/comparativo-eleitores')) return Promise.resolve({ rows: [] });
      if (path.includes('/elections/relatorio-faltantes')) return Promise.resolve({ summary: [], missing: [], totalCadastrados: 0, totalApurado: 0, totalFaltantes: 0 });
      return Promise.reject(new Error('unexpected path'));
    });

    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    await waitFor(() => expect(screen.getByText('Nenhum registro encontrado para os filtros atuais.')).toBeInTheDocument());
  });

  it('exibe o resumo por equipe e somente as zonas com votos faltantes', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    expect(await screen.findByText('Resumo por cabo e subcabo')).toBeInTheDocument();
    expect(screen.getAllByText('Faltantes').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Faltantes' }).length).toBeGreaterThan(0);
    expect(screen.getByText('16,7% dos prometidos')).toBeInTheDocument();
    expect(screen.getByText('Exportar relatório PDF')).toBeInTheDocument();
  });

  it('exibe o relatório nominal ao clicar no botão de nomes', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Ver nomes dos eleitores' }));

    expect(await screen.findByText(/Eleitores cadastrados nas seções abaixo da meta/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.stringContaining('/elections/relatorio-faltantes/eleitores?'));
  });
});
