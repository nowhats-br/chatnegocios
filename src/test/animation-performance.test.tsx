import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { 
  getAnimationConfig,
  getOptimizedAnimationClasses
} from '../utils/animationUtils';
import { AnimationPerformanceMonitor } from '../components/ui/AnimationPerformanceMonitor';

// Mock matchMedia for reduced motion testing
const mockMatchMedia = vi.fn();

beforeEach(() => {
  global.matchMedia = mockMatchMedia;
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
  global.cancelAnimationFrame = vi.fn();
  
  // Reset mocks
  mockMatchMedia.mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Animation Configuration', () => {
  it('should return optimized config for normal motion', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    
    const config = getAnimationConfig(300);
    
    expect(config.shouldAnimate).toBe(true);
    expect(config.duration).toBeGreaterThan(0);
    expect(config.easing).toBeDefined();
  });

  it('should disable animations for reduced motion', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    
    const config = getAnimationConfig(300);
    
    expect(config.shouldAnimate).toBe(false);
    expect(config.duration).toBe(0);
  });
});

describe('Optimized Animation Classes', () => {
  it('should generate performance-optimized classes', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    
    const classes = getOptimizedAnimationClasses('hover:scale-105', 'hover');
    
    expect(classes).toContain('transform-gpu');
    expect(classes).toContain('transition-all');
    expect(classes).toContain('motion-reduce:transition-none');
    expect(classes).toContain('backface-visibility-hidden');
  });

  it('should return reduced motion classes when preferred', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    
    const classes = getOptimizedAnimationClasses('hover:scale-105', 'hover');
    
    expect(classes).toBe('motion-reduce:transition-none motion-reduce:transform-none');
  });
});

describe('AnimationPerformanceMonitor Component', () => {
  it('should render performance metrics when enabled', () => {
    render(
      <AnimationPerformanceMonitor 
        showMetrics={true}
        showReducedMotionStatus={true}
      />
    );
    
    expect(screen.getByText('Motion Preferences')).toBeInTheDocument();
  });

  it('should show reduced motion status', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    
    render(
      <AnimationPerformanceMonitor 
        showReducedMotionStatus={true}
      />
    );
    
    expect(screen.getByText('Reduced')).toBeInTheDocument();
  });

  it('should handle performance issues callback', () => {
    const onPerformanceIssue = vi.fn();
    
    render(
      <AnimationPerformanceMonitor 
        onPerformanceIssue={onPerformanceIssue}
        threshold={60}
      />
    );
    
    // Component should be rendered without errors
    expect(screen.queryByText('Motion Preferences')).toBeInTheDocument();
  });
});