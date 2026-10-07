import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Crossing from './Crossing';
import { api } from '../lib/api';

vi.mock('../components/AppHeader', () => ({
  default: ({ title, subtitle }) => (
    <div data-testid="app-header">{title} - {subtitle}</div>
  )
}));
vi.mock('../components/Icon', () => ({
  default: ({ name }) => <span data-testid="icon">{name}</span>
}));
vi.mock('../lib/api', () => ({
  api: vi.fn()
}));

describe('Crossing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar os dados de Keiva vs Adversário', async () => {
    api.mockImplementation((path) => {
      if (path === '/candidatos') return Promise.resolve([]);
      if (path.includes('/elections/comparativo')) return Promise.resolve({
        keiva: 52.4,
        nomeAdversario: 'Eduardo Silveira',
        oponente: 47.6,
        vantagem: 4.8,
        demografia: []
      });
      return Promise.reject(new Error('not found'));
    });
    
    render(<Crossing />);
    
    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Keiva Dias/)).toBeInTheDocument();
    expect(screen.getByText(/Eduardo Silveira/)).toBeInTheDocument();
    expect(screen.getByText(/Keiva \+4\.8%/)).toBeInTheDocument();
  });
});