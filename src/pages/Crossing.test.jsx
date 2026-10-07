import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import Crossing from './Crossing';
import { api } from '../lib/api';

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => (
    <div data-testid="app-header">{title} - {subtitle}</div>
  )
}));
vi.mock('../lib/api', () => ({
  api: vi.fn()
}));

describe('Crossing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe mensagem pedindo para selecionar candidato inicialmente', async () => {
    api.mockResolvedValueOnce([{ id: 1, nome: 'Keiva Dias' }]);
    render(<Crossing />);
    
    expect(screen.getByText('Selecione um candidato para ver os dados.')).toBeInTheDocument();
  });

  it('carrega e renderiza os dados de auditoria após seleção de candidato', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidates') return Promise.resolve({ candidates: [{ id: 1, name: 'Keiva Dias', nome: 'Keiva Dias' }] });
      if (path.includes('/elections/comparativo-zona?candidateName=Keiva%20Dias')) return Promise.resolve([
        { zona: 1, secao: 10, coletado: 100, tse: 100 },
        { zona: 2, secao: 20, coletado: 120, tse: 100 }
      ]);
      return Promise.reject(new Error('not found'));
    });
    
    render(<Crossing />);
    
    // Aguarda o dropdown ter a opção
    const option = await screen.findByText('Keiva Dias');
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: 'Keiva Dias' } });
    
    expect(screen.getByText('Carregando auditoria...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Zona 1 — Seção 10')).toBeInTheDocument();
    });

    expect(screen.getByText('✓ 100% Batido')).toBeInTheDocument();
    
    expect(screen.getByText('Zona 2 — Seção 20')).toBeInTheDocument();
    expect(screen.getByText('⚠️ Divergência: 20 votos')).toBeInTheDocument();
  });

  it('renderiza vazio se não houver dados para o candidato', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidates') return Promise.resolve({ candidates: [{ id: 1, name: 'Keiva Dias', nome: 'Keiva Dias' }] });
      if (path.includes('/elections/comparativo-zona')) return Promise.resolve([]);
      return Promise.reject(new Error('not found'));
    });
    
    render(<Crossing />);
    
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'Keiva Dias' } });
    
    await waitFor(() => {
      expect(screen.getByText('Nenhum dado encontrado.')).toBeInTheDocument();
    });
  });
});