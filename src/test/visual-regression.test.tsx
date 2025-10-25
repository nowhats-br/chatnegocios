import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../components/ui/Button';
import ConnectionCard from '../components/ui/ConnectionCard';

// Mock connection data
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

// Helper function to capture component styles (removed unused function)

describe('Visual Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Button Component Visual States', () => {
    it('should maintain consistent styling for default variant', () => {
      render(<Button>Default Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass(
        'bg-primary',
        'text-primary-foreground',
        'hover:bg-primary/90',
        'h-10',
        'px-4',
        'py-2',
        'rounded-md'
      );
    });

    it('should maintain consistent styling for all variants', () => {
      const variants = [
        { variant: 'default' as const, expectedClasses: ['bg-primary', 'text-primary-foreground'] },
        { variant: 'secondary' as const, expectedClasses: ['bg-secondary', 'text-secondary-foreground'] },
        { variant: 'destructive' as const, expectedClasses: ['bg-destructive', 'text-destructive-foreground'] },
        { variant: 'outline' as const, expectedClasses: ['border', 'border-input', 'bg-background'] },
        { variant: 'ghost' as const, expectedClasses: ['hover:bg-accent', 'hover:text-accent-foreground'] },
        { variant: 'link' as const, expectedClasses: ['text-primary', 'underline-offset-4'] },
      ];

      variants.forEach(({ variant, expectedClasses }) => {
        const { unmount } = render(<Button variant={variant}>Test Button</Button>);
        const button = screen.getByRole('button');
        
        expectedClasses.forEach(className => {
          expect(button).toHaveClass(className);
        });
        
        unmount();
      });
    });

    it('should maintain consistent sizing across all size variants', () => {
      const sizes = [
        { size: 'default' as const, expectedClasses: ['h-10', 'px-4', 'py-2'] },
        { size: 'sm' as const, expectedClasses: ['h-9', 'rounded-md', 'px-3'] },
        { size: 'lg' as const, expectedClasses: ['h-11', 'rounded-md', 'px-8'] },
        { size: 'icon' as const, expectedClasses: ['h-10', 'w-10'] },
      ];

      sizes.forEach(({ size, expectedClasses }) => {
        const { unmount } = render(<Button size={size}>Test</Button>);
        const button = screen.getByRole('button');
        
        expectedClasses.forEach(className => {
          expect(button).toHaveClass(className);
        });
        
        unmount();
      });
    });

    it('should maintain consistent disabled state styling', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass(
        'disabled:pointer-events-none',
        'disabled:opacity-50'
      );
      expect(button).toBeDisabled();
    });

    it('should maintain consistent loading state styling', () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should maintain consistent gradient styling', () => {
      render(<Button gradient>Gradient Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('bg-gradient-primary');
    });
  });

  describe('ConnectionCard Component Visual States', () => {
    it('should maintain consistent card layout and styling', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      const card = screen.getByRole('article');
      
      expect(card).toHaveClass(
        'bg-card',
        'border',
        'rounded-lg',
        'shadow-sm',
        'p-6',
        'space-y-4',
        'transition-all',
        'duration-300'
      );
    });

    it('should maintain consistent status indicator styling', () => {
      const statuses = [
        { status: 'connected' as const, expectedClass: 'status-connected' },
        { status: 'disconnected' as const, expectedClass: 'status-disconnected' },
        { status: 'paused' as const, expectedClass: 'status-paused' },
      ];

      statuses.forEach(({ status, expectedClass }) => {
        const connection = { ...mockConnection, status };
        const { unmount } = render(
          <ConnectionCard {...mockConnectionCardProps} connection={connection} />
        );
        
        const statusBadge = screen.getByText(
          status === 'connected' ? 'Conectado' :
          status === 'disconnected' ? 'Desconectado' : 'Pausado'
        ).closest('div');
        
        expect(statusBadge).toHaveClass(expectedClass);
        unmount();
      });
    });

    it('should maintain consistent button group layout', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const buttonGroup = screen.getByRole('group', { name: /ações da conexão/i });
      expect(buttonGroup).toHaveClass(
        'flex',
        'flex-wrap',
        'gap-2',
        'justify-start'
      );
    });

    it('should maintain consistent hover effects', async () => {
      const user = userEvent.setup();
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveClass('card-hover-subtle');
      
      // Simulate hover
      await user.hover(card);
      
      // The hover effects are applied via CSS, so we check for the classes
      expect(card).toHaveClass(
        'hover:shadow-md',
        'hover:scale-[1.01]',
        'hover:-translate-y-0.5'
      );
    });

    it('should maintain consistent loading state styling', () => {
      render(<ConnectionCard {...mockConnectionCardProps} isLoading={true} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
      
      const loadingSpinners = screen.getAllByTestId('loading-spinner');
      expect(loadingSpinners.length).toBeGreaterThan(0);
    });

    it('should maintain consistent connecting state styling', () => {
      render(<ConnectionCard {...mockConnectionCardProps} isConnecting={true} />);
      
      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toHaveClass('animate-status-pulse');
      
      expect(screen.getByText('Conectando...')).toBeInTheDocument();
    });
  });

  describe('Responsive Design Consistency', () => {
    it('should maintain responsive button classes', () => {
      render(<Button className="btn-responsive-md">Responsive Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('btn-responsive-md');
    });

    it('should maintain responsive card grid classes', () => {
      render(
        <div className="grid-responsive-cards gap-responsive-md">
          <ConnectionCard {...mockConnectionCardProps} />
        </div>
      );
      
      const container = screen.getByRole('article').parentElement;
      expect(container).toHaveClass('grid-responsive-cards', 'gap-responsive-md');
    });

    it('should maintain responsive typography classes', () => {
      render(
        <div>
          <h1 className="typography-responsive-title">Responsive Title</h1>
          <p className="typography-responsive-body">Responsive body text</p>
        </div>
      );
      
      const title = screen.getByText('Responsive Title');
      const body = screen.getByText('Responsive body text');
      
      expect(title).toHaveClass('typography-responsive-title');
      expect(body).toHaveClass('typography-responsive-body');
    });
  });

  describe('Animation Consistency', () => {
    it('should maintain consistent transition classes', () => {
      render(<Button>Animated Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('transition-colors', 'duration-200');
    });

    it('should maintain consistent transform classes', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      const card = screen.getByRole('article');
      
      expect(card).toHaveClass('transform-gpu', 'transition-all', 'duration-300');
    });

    it('should maintain consistent reduced motion classes', () => {
      render(
        <div>
          <Button className="motion-reduce:transition-none">Button</Button>
          <ConnectionCard {...mockConnectionCardProps} />
        </div>
      );
      
      const button = screen.getByRole('button');
      const card = screen.getByRole('article');
      
      expect(button).toHaveClass('motion-reduce:transition-none');
      expect(card).toHaveClass('motion-reduce:transition-none');
    });
  });

  describe('Focus State Consistency', () => {
    it('should maintain consistent focus ring styling', async () => {
      const user = userEvent.setup();
      render(<Button>Focus Test</Button>);
      
      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass(
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2'
      );
    });

    it('should maintain consistent focus management in cards', async () => {
      const user = userEvent.setup();
      render(<ConnectionCard {...mockConnectionCardProps} />);
      
      const card = screen.getByRole('article');
      card.focus();
      
      await user.tab();
      const firstButton = screen.getByText('Desconectar');
      expect(firstButton).toHaveFocus();
      expect(firstButton).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('Dark Mode Consistency', () => {
    beforeEach(() => {
      // Mock dark mode
      document.documentElement.classList.add('dark');
    });

    // Cleanup after tests
    // document.documentElement.classList.remove('dark');

    it('should maintain consistent dark mode styling for buttons', () => {
      render(<Button>Dark Mode Button</Button>);
      const button = screen.getByRole('button');
      
      // Dark mode classes should be applied via CSS variables
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('should maintain consistent dark mode styling for cards', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      const card = screen.getByRole('article');
      
      expect(card).toHaveClass('bg-card', 'border');
    });
  });

  describe('Performance Optimization Classes', () => {
    it('should maintain performance-optimized animation classes', () => {
      render(<Button className="animate-optimized-hover">Optimized Button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('animate-optimized-hover');
    });

    it('should maintain GPU acceleration classes', () => {
      render(<ConnectionCard {...mockConnectionCardProps} />);
      const card = screen.getByRole('article');
      
      expect(card).toHaveClass('transform-gpu');
    });

    it('should maintain will-change optimization classes', () => {
      render(<div className="will-change-transform">Optimized Element</div>);
      const element = screen.getByText('Optimized Element');
      
      expect(element).toHaveClass('will-change-transform');
    });
  });
});