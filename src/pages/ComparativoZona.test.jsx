import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ComparativoZona from './ComparativoZona';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => <div data-testid="app-header">{title} - {subtitle}</div>
}));

describe('ComparativoZona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    api.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));
    render(<ComparativoZona />);
    expect(screen.getByText('Carregando auditoria...')).toBeInTheDocument();
  });

  it('renders empty state when no data is found', async () => {
    api.mockResolvedValueOnce([]);
    render(<ComparativoZona />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum dado encontrado.')).toBeInTheDocument();
    });
  });

  it('renders data with no divergence correctly', async () => {
    api.mockResolvedValueOnce([
      { zona: 1, secao: 10, coletado: 100, tse: 100 }
    ]);
    render(<ComparativoZona />);
    await waitFor(() => {
      expect(screen.getByText('Zona 1 — Seção 10')).toBeInTheDocument();
      expect(screen.getByText('✓ 100% Batido')).toBeInTheDocument();
    });
  });

  it('renders data with divergence correctly', async () => {
    api.mockResolvedValueOnce([
      { zona: 2, secao: 20, coletado: 120, tse: 100 }
    ]);
    render(<ComparativoZona />);
    await waitFor(() => {
      expect(screen.getByText('Zona 2 — Seção 20')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Divergência: 20 votos')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    api.mockRejectedValueOnce(new Error('API Error'));
    render(<ComparativoZona />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum dado encontrado.')).toBeInTheDocument();
    });
  });
});
