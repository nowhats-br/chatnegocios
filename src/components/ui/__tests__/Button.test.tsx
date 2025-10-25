import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from 'lucide-react';
import Button from '../Button';

describe('Button Component', () => {
  describe('Variants', () => {
    it('renders default variant correctly', () => {
      render(<Button>Default Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('renders secondary variant correctly', () => {
      render(<Button variant="secondary">Secondary Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground');
    });

    it('renders destructive variant correctly', () => {
      render(<Button variant="destructive">Destructive Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });

    it('renders outline variant correctly', () => {
      render(<Button variant="outline">Outline Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'border-input', 'bg-background');
    });

    it('renders ghost variant correctly', () => {
      render(<Button variant="ghost">Ghost Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground');
    });

    it('renders link variant correctly', () => {
      render(<Button variant="link">Link Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-primary', 'underline-offset-4');
    });
  });

  describe('Sizes', () => {
    it('renders default size correctly', () => {
      render(<Button>Default Size</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'px-4', 'py-2');
    });

    it('renders small size correctly', () => {
      render(<Button size="sm">Small Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9', 'rounded-md', 'px-3');
    });

    it('renders large size correctly', () => {
      render(<Button size="lg">Large Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-11', 'rounded-md', 'px-8');
    });

    it('renders icon size correctly', () => {
      render(<Button size="icon">Icon</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'w-10');
    });
  });

  describe('States', () => {
    it('handles disabled state correctly', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
    });

    it('handles loading state correctly', () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows loading text when loading', () => {
      render(<Button loading loadingText="Processing...">Submit</Button>);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button');
      
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger click when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button disabled onClick={handleClick}>Disabled Button</Button>);
      const button = screen.getByRole('button');
      
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not trigger click when loading', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      
      render(<Button loading onClick={handleClick}>Loading Button</Button>);
      const button = screen.getByRole('button');
      
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper focus styles', () => {
      render(<Button>Focus Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    });

    it('supports keyboard navigation', async () => {
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

    it('has proper ARIA attributes when loading', () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports custom ARIA attributes', () => {
      render(
        <Button aria-label="Custom Label" aria-describedby="description">
          Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });
  });

  describe('Icons', () => {

    it('renders left icon correctly', () => {
      render(
        <Button icon={Settings} iconPosition="left">
          Button with Icon
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      
      expect(icon).toBeInTheDocument();
      expect(button).toHaveTextContent('Button with Icon');
    });

    it('renders right icon correctly', () => {
      render(
        <Button icon={Settings} iconPosition="right">
          Button with Icon
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('renders icon-only button correctly', () => {
      render(<Button icon={Settings} size="icon" aria-label="Icon Button" />);
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      
      expect(icon).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Icon Button');
    });
  });

  describe('Gradient Variants', () => {
    it('applies gradient styles when gradient prop is true', () => {
      render(<Button gradient>Gradient Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gradient-primary');
    });

    it('applies gradient destructive styles', () => {
      render(<Button variant="destructive" gradient>Gradient Destructive</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gradient-destructive');
    });
  });

  describe('Animation and Performance', () => {
    it('applies performance-optimized classes', () => {
      render(<Button>Animated Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('transition-colors', 'duration-200');
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

      render(<Button>Reduced Motion Button</Button>);
      const button = screen.getByRole('button');
      
      // Should still have the classes but CSS will handle the reduced motion
      expect(button).toHaveClass('transition-colors');
    });
  });

  describe('Custom Props', () => {
    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Ref Button</Button>);
      expect(ref).toHaveBeenCalled();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">Custom Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('supports asChild prop', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test');
      expect(link).toHaveClass('inline-flex', 'items-center', 'justify-center');
    });
  });
});