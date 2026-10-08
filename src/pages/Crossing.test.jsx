import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import Crossing from './Crossing';
import { api } from '../lib/api';

const adminUser = vi.hoisted(() => ({ role: 'ADMIN' }));

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => <div data-testid="app-header">{title} - {subtitle}</div>,
}));

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  getUser: vi.fn(() => adminUser),
}));

const rows = [
  {
    cabo: 'Felipe', subcabo: 'Pedro', zona: '02', secao: '0533',
    cadastrados: 2, apurado: 3, diferenca: -1, status: 'Apurado excede em 1',
  },
  {
    cabo: 'Felipe', subcabo: 'João', zona: '03', secao: '0987',
    cadastrados: 4, apurado: 5, diferenca: -1, status: 'Apurado excede em 1',
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
      if (path.includes('/elections/comparativo-eleitores')) return Promise.resolve({ rows });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exibe os agrupamentos cadastrados e o apurado TSE após escolher candidata', async () => {
    render(<Crossing />);

    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    expect(await screen.findByText('Carregando comparação...')).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Votos cadastrados' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Apurado TSE' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Pedro')).toBeInTheDocument();
    expect(within(table).getByText('0533')).toBeInTheDocument();
    expect(within(table).getByText('2')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('filtra a tabela por subcabo e zona sem remover os demais filtros', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '11' } });
    expect(within(screen.getByRole('table')).getByText('Pedro')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('João')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Subcabo'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: '03' } });
    expect(within(screen.getByRole('table')).queryByText('Pedro')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('João')).toBeInTheDocument();
  });

  it('mostra apenas os subcabos vinculados ao cabo selecionado', async () => {
    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));
    await screen.findByRole('columnheader', { name: 'Apurado TSE' });

    fireEvent.change(screen.getByLabelText('Cabo'), { target: { value: '10' } });
    const subcaboFilter = screen.getByLabelText('Subcabo');
    expect(within(subcaboFilter).getByRole('option', { name: 'Pedro' })).toBeInTheDocument();
    expect(within(subcaboFilter).getByRole('option', { name: 'João' })).toBeInTheDocument();
    expect(within(subcaboFilter).queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument();
  });

  it('mostra mensagem vazia quando a candidata não possui linhas', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidates') return Promise.resolve({ candidates: [{ id: 1, name: 'Keivia Dias' }] });
      if (path === '/dashboard/list?type=cabos' || path === '/dashboard/list?type=subcabos') return Promise.resolve({ items: [] });
      if (path.includes('/elections/comparativo-eleitores')) return Promise.resolve({ rows: [] });
      return Promise.reject(new Error('unexpected path'));
    });

    render(<Crossing />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keivia Dias' }));

    await waitFor(() => expect(screen.getByText('Nenhum registro encontrado para os filtros atuais.')).toBeInTheDocument());
  });
});
