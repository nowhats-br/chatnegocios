import type { Meta, StoryObj } from '@storybook/react';
import { AnimationDemo } from './AnimationDemo';
import { AnimationPerformanceMonitor } from './AnimationPerformanceMonitor';

const meta: Meta<typeof AnimationDemo> = {
  title: 'Components/Animation Performance',
  component: AnimationDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Animation performance monitoring and optimization system that respects user preferences and device capabilities.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Demo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo showcasing animation performance optimization features including reduced motion support and GPU acceleration.',
      },
    },
  },
};

export const PerformanceMonitor: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="typography-h2 mb-4">Performance Monitor</h2>
      <p className="typography-body text-muted-foreground mb-6">
        The performance monitor tracks animation frame rates and provides real-time feedback.
      </p>
      <AnimationPerformanceMonitor
        showMetrics={true}
        showReducedMotionStatus={true}
        trackGlobalPerformance={true}
        threshold={30}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Performance monitor component that displays real-time animation metrics and reduced motion status.',
      },
    },
  },
};

export const ReducedMotionDemo: Story = {
  render: () => (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="typography-h2 mb-2">Reduced Motion Support</h2>
        <p className="typography-body text-muted-foreground">
          Test reduced motion support by enabling "Reduce motion" in your system accessibility settings.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 hover:scale-105 hover:shadow-lg transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer">
          <h3 className="typography-h6 mb-2">Motion Enabled</h3>
          <p className="text-sm text-muted-foreground">
            This card animates when motion is enabled, but respects reduced motion preferences.
          </p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="typography-h6 mb-2">Always Static</h3>
          <p className="text-sm text-muted-foreground">
            This card never animates, providing a consistent experience for all users.
          </p>
        </div>
      </div>
      
      <AnimationPerformanceMonitor
        showReducedMotionStatus={true}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates how animations respect the prefers-reduced-motion user preference.',
      },
    },
  },
};