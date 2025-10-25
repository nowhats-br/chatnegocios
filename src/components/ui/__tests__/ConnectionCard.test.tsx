import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectionCard from '../ConnectionCard';
import { beforeEach } from 'node:test';

// Mock the connection data
const mockConnection = {
  id: '1',
  name: 'test-connection',
  status: 'connected' as const,
  instance_data: {
    owner: '5511999999999@c.us',
    pushName: 'Test User'
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockProps = {
  connection: mockConnection,
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onDelete: vi.fn(),
  onShowQR: vi.fn(),
  isConnecting: false,
  isLoading: false
};

describe('ConnectionCard Component', () => {
  beforeEach(() => {
    // Mock setup
  });

  describe('Rendering', () => {
    it('renders connection card with basic information', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByText('test-connection')).toBeInTheDocument();
      expect(screen.getByText('5511999999999')).toBeInTheDocument();
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });

    it('displays correct status for different connection states', () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      expect(screen.getByText('Desconectado')).toBeInTheDocument();
    });

    it('shows connecting status when isConnecting is true', () => {
      render(<ConnectionCard {...mockProps} isConnecting={true} />);
      
      expect(screen.getByText('Conectando...')).toBeInTheDocument();
    });

    it('shows paused status correctly', () => {
      const pausedConnection = { ...mockConnection, status: 'paused' as const };
      render(<ConnectionCard {...mockProps} connection={pausedConnection} />);
      
      expect(screen.getByText('Pausado')).toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('displays correct status colors for connected state', () => {
      render(<ConnectionCard {...mockProps} />);
      
      const statusBadge = screen.getByText('Conectado').closest('div');
      expect(statusBadge).toHaveClass('status-connected');
    });

    it('displays correct status colors for disconnected state', () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      const statusBadge = screen.getByText('Desconectado').closest('div');
      expect(statusBadge).toHaveClass('status-disconnected');
    });

    it('shows animated status indicator when connecting', () => {
      render(<ConnectionCard {...mockProps} isConnecting={true} />);
      
      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toHaveClass('animate-status-pulse');
    });
  });

  describe('Action Buttons', () => {
    it('shows connect button when disconnected', () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      expect(screen.getByText('Conectar')).toBeInTheDocument();
    });

    it('shows disconnect button when connected', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByText('Desconectar')).toBeInTheDocument();
    });

    it('shows pause button when connected', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByText('Pausar')).toBeInTheDocument();
    });

    it('shows resume button when paused', () => {
      const pausedConnection = { ...mockConnection, status: 'paused' as const };
      render(<ConnectionCard {...mockProps} connection={pausedConnection} />);
      
      expect(screen.getByText('Retomar')).toBeInTheDocument();
    });

    it('shows QR code button when disconnected', () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      expect(screen.getByText('QR Code')).toBeInTheDocument();
    });

    it('shows delete button', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByText('Excluir')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onConnect when connect button is clicked', async () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      const connectButton = screen.getByText('Conectar');
      await user.click(connectButton);
      
      expect(mockProps.onConnect).toHaveBeenCalledWith(mockConnection);
    });

    it('calls onDisconnect when disconnect button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} />);
      
      const disconnectButton = screen.getByText('Desconectar');
      await user.click(disconnectButton);
      
      expect(mockProps.onDisconnect).toHaveBeenCalledWith(mockConnection);
    });

    it('calls onPause when pause button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} />);
      
      const pauseButton = screen.getByText('Pausar');
      await user.click(pauseButton);
      
      expect(mockProps.onPause).toHaveBeenCalledWith(mockConnection);
    });

    it('calls onResume when resume button is clicked', async () => {
      const pausedConnection = { ...mockConnection, status: 'paused' as const };
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} connection={pausedConnection} />);
      
      const resumeButton = screen.getByText('Retomar');
      await user.click(resumeButton);
      
      expect(mockProps.onResume).toHaveBeenCalledWith(mockConnection);
    });

    it('calls onShowQR when QR code button is clicked', async () => {
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      const qrButton = screen.getByText('QR Code');
      await user.click(qrButton);
      
      expect(mockProps.onShowQR).toHaveBeenCalledWith(mockConnection);
    });

    it('calls onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} />);
      
      const deleteButton = screen.getByText('Excluir');
      await user.click(deleteButton);
      
      expect(mockProps.onDelete).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe('Loading States', () => {
    it('disables buttons when isLoading is true', () => {
      render(<ConnectionCard {...mockProps} isLoading={true} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('shows loading spinner on buttons when isLoading is true', () => {
      render(<ConnectionCard {...mockProps} isLoading={true} />);
      
      const loadingSpinners = screen.getAllByTestId('loading-spinner');
      expect(loadingSpinners.length).toBeGreaterThan(0);
    });

    it('disables buttons when isConnecting is true', () => {
      render(<ConnectionCard {...mockProps} isConnecting={true} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for buttons', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByLabelText('Desconectar conexão test-connection')).toBeInTheDocument();
      expect(screen.getByLabelText('Pausar conexão test-connection')).toBeInTheDocument();
      expect(screen.getByLabelText('Excluir conexão test-connection')).toBeInTheDocument();
    });

    it('has proper role and accessibility attributes', () => {
      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Cartão de conexão test-connection');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      card.focus();
      
      // Tab through buttons
      await user.tab();
      expect(screen.getByText('Desconectar')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Pausar')).toHaveFocus();
    });

    it('announces status changes to screen readers', () => {
      const { rerender } = render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByLabelText('Status da conexão: Conectado')).toBeInTheDocument();
      
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      rerender(<ConnectionCard {...mockProps} connection={disconnectedConnection} />);
      
      expect(screen.getByLabelText('Status da conexão: Desconectado')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('applies hover effects correctly', () => {
      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('card-hover-subtle');
    });

    it('applies correct styling for different status states', () => {
      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('border-success/20');
    });

    it('shows connecting animation when isConnecting is true', () => {
      render(<ConnectionCard {...mockProps} isConnecting={true} />);
      
      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toHaveClass('animate-status-pulse');
    });
  });

  describe('Phone Number Formatting', () => {
    it('formats phone number correctly', () => {
      render(<ConnectionCard {...mockProps} />);
      
      expect(screen.getByText('5511999999999')).toBeInTheDocument();
    });

    it('handles missing phone number gracefully', () => {
      const connectionWithoutPhone = {
        ...mockConnection,
        instance_data: {}
      };
      
      render(<ConnectionCard {...mockProps} connection={connectionWithoutPhone} />);
      
      expect(screen.getByText('Não disponível')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('applies performance-optimized classes', () => {
      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('transform-gpu', 'transition-all');
    });

    it('respects reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<ConnectionCard {...mockProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('motion-reduce:transition-none');
    });
  });
});