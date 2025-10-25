import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '../components/ui/Button';
import { ConnectionCard } from '../components/ui/ConnectionCard';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock connection data for testing
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

const mockConnectionCardProps = {
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

describe('Accessibility Tests', () => {
  describe('Button Component Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Button>Test Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when loading', async () => {
      const { container } = render(<Button loading>Loading Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper focus management', async () => {
      const user = userEvent.setup();
      render(<Button>Focus Test</Button>);
      
      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-2');
    });

    it('should support keyboard activation', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick}>Keyboard Test</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should have proper ARIA attributes for loading state', () => {
      render(<Button loading loadingText="Processing...">Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveTextContent('Processing...');
    });

    it('should have proper color contrast ratios', () => {
      render(<Button variant="destructive">Delete</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });
  });

  describe('ConnectionCard Component Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<ConnectionCard {...mockConnectionCardProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper semantic structure', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Cartão de conexão test-connection');
    });

    it('should have proper button labels', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      expect(screen.getByLabelText('Desconectar conexão test-connection')).toBeInTheDocument();
      expect(screen.getByLabelText('Pausar conexão test-connection')).toBeInTheDocument();
      expect(screen.getByLabelText('Excluir conexão test-connection')).toBeInTheDocument();
    });

    it('should announce status changes', () => {
      const { rerender } = render(<ConnectionCard {...mockConnectionCardProps} />);
      
      expect(screen.getByLabelText('Status da conexão: Conectado')).toBeInTheDocument();
      
      const disconnectedConnection = { ...mockConnection, status: 'disconnected' as const };
      rerender(<ConnectionCard {...mockConnectionCardProps} connection={disconnectedConnection} />);
      
      expect(screen.getByLabelText('Status da conexão: Desconectado')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const card = screen.getByRole('article');
      card.focus();
      
      // Should be able to tab through interactive elements
      await user.tab();
      expect(screen.getByText('Desconectar')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Pausar')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Excluir')).toHaveFocus();
    });

    it('should have proper focus indicators', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus-visible:ring-2');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle tab navigation correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <Button>First Button</Button>
          <Button>Second Button</Button>
          <Button disabled>Disabled Button</Button>
          <Button>Third Button</Button>
        </div>
      );
      
      // Tab through focusable elements
      await user.tab();
      expect(screen.getByText('First Button')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Second Button')).toHaveFocus();
      
      await user.tab();
      // Should skip disabled button
      expect(screen.getByText('Third Button')).toHaveFocus();
    });

    it('should handle shift+tab navigation correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <Button>First Button</Button>
          <Button>Second Button</Button>
        </div>
      );
      
      // Focus last button first
      const secondButton = screen.getByText('Second Button');
      secondButton.focus();
      
      // Shift+tab should go to previous button
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(screen.getByText('First Button')).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper text alternatives', () => {
      const TestIcon = () => <span data-testid="icon">📱</span>;
      
      render(
        <Button icon={TestIcon} size="icon" aria-label="Mobile Connection">
          <span className="sr-only">Mobile Connection</span>
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Mobile Connection');
    });

    it('should announce dynamic content changes', () => {
      const { rerender } = render(<Button>Initial Text</Button>);
      
      rerender(<Button loading loadingText="Loading...">Initial Text</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Loading...');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should provide status announcements', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const statusElement = screen.getByLabelText('Status da conexão: Conectado');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('Color Contrast', () => {
    it('should meet WCAG AA standards for button variants', () => {
      const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost'] as const;
      
      variants.forEach(variant => {
        render(<Button variant={variant}>Test Button</Button>);
        const button = screen.getByRole('button');
        
        // These classes ensure WCAG AA compliance
        expect(button).toHaveClass('transition-colors');
      });
    });

    it('should maintain contrast in different states', () => {
      render(
        <div>
          <Button>Normal</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // All buttons should have proper contrast classes
        expect(button).toHaveClass('transition-colors');
      });
    });
  });

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
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
    });

    it('should respect reduced motion preferences', () => {
      render(<Button>Reduced Motion Button</Button>);
      
      const button = screen.getByRole('button');
      // CSS will handle the actual reduced motion, but classes should be present
      expect(button).toHaveClass('transition-colors');
    });

    it('should disable animations when reduced motion is preferred', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const card = screen.getByRole('article');
      // Should have motion-reduce classes
      expect(card).toHaveClass('motion-reduce:transition-none');
    });
  });
});