import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from './Button';
import { Loader2, Plus, Trash2, Download, Settings } from 'lucide-react';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Button Component

A versatile button component with multiple variants, sizes, and states. Built with accessibility and performance in mind.

## Features

- **Multiple Variants**: Primary, secondary, destructive, outline, ghost, and link styles
- **Flexible Sizing**: Small, default, large, and icon-only sizes
- **Loading States**: Built-in loading spinner and text support
- **Icon Support**: Left or right positioned icons
- **Gradient Options**: Enhanced visual appeal with gradient backgrounds
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Optimized animations with reduced motion support

## Design Tokens

The button component uses design tokens from our design system:
- Colors: Primary, secondary, destructive color scales
- Spacing: Consistent padding and margins
- Typography: Proper font weights and sizes
- Shadows: Subtle elevation effects
- Animations: Smooth transitions and hover effects
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Size of the button',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Shows loading spinner and disables interaction',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disables the button',
    },
    gradient: {
      control: { type: 'boolean' },
      description: 'Applies gradient background styling',
    },
    iconPosition: {
      control: { type: 'select' },
      options: ['left', 'right'],
      description: 'Position of the icon relative to text',
    },
    loadingText: {
      control: { type: 'text' },
      description: 'Text to show when loading (optional)',
    },
    onClick: { action: 'clicked' },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    icon: Settings,
    'aria-label': 'Settings',
  },
};

// States
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const LoadingWithText: Story = {
  args: {
    loading: true,
    loadingText: 'Processing...',
    children: 'Submit',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

// With Icons
export const WithLeftIcon: Story = {
  args: {
    icon: Plus,
    iconPosition: 'left',
    children: 'Add Item',
  },
};

export const WithRightIcon: Story = {
  args: {
    icon: Download,
    iconPosition: 'right',
    children: 'Download',
  },
};

// Gradient variants
export const GradientPrimary: Story = {
  args: {
    gradient: true,
    children: 'Gradient Primary',
  },
};

export const GradientDestructive: Story = {
  args: {
    variant: 'destructive',
    gradient: true,
    icon: Trash2,
    iconPosition: 'left',
    children: 'Delete Forever',
  },
};

// Interactive examples
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All button variants displayed together for comparison.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Settings">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All button sizes displayed together for comparison.',
      },
    },
  },
};

export const LoadingStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <Button loading>Loading</Button>
      <Button loading loadingText="Saving...">Save</Button>
      <Button variant="destructive" loading loadingText="Deleting...">
        Delete
      </Button>
      <Button variant="outline" loading>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Custom Loading
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different loading states and loading text examples.',
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <Button icon={Plus} iconPosition="left">
        Add New
      </Button>
      <Button icon={Download} iconPosition="right" variant="outline">
        Download
      </Button>
      <Button icon={Trash2} variant="destructive" size="sm">
        Delete
      </Button>
      <Button icon={Settings} size="icon" variant="ghost" aria-label="Settings" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Buttons with icons in different positions and configurations.',
      },
    },
  },
};

export const GradientVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <Button gradient>Gradient Primary</Button>
      <Button variant="destructive" gradient>
        Gradient Destructive
      </Button>
      <Button gradient icon={Plus} iconPosition="left">
        Add with Gradient
      </Button>
      <Button variant="destructive" gradient loading loadingText="Deleting...">
        Loading Gradient
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Gradient button variants with enhanced visual appeal.',
      },
    },
  },
};

// Accessibility demonstration
export const AccessibilityDemo: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Keyboard Navigation</h3>
        <p className="text-sm text-muted-foreground">
          Use Tab to navigate, Enter or Space to activate
        </p>
        <div className="flex gap-2">
          <Button>First</Button>
          <Button variant="outline">Second</Button>
          <Button disabled>Disabled (Skipped)</Button>
          <Button variant="destructive">Third</Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Screen Reader Support</h3>
        <div className="flex gap-2">
          <Button aria-label="Add new item" icon={Plus} size="icon" />
          <Button loading aria-describedby="loading-desc">
            Processing
          </Button>
          <span id="loading-desc" className="sr-only">
            Please wait while we process your request
          </span>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Accessibility features including keyboard navigation and screen reader support.',
      },
    },
  },
};

// Performance demonstration
export const PerformanceDemo: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Optimized Animations</h3>
        <p className="text-sm text-muted-foreground">
          Hover over buttons to see smooth, GPU-accelerated animations
        </p>
        <div className="flex gap-2">
          <Button className="animate-optimized-hover">Optimized Hover</Button>
          <Button variant="outline" className="animate-optimized-hover">
            Smooth Transition
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Reduced Motion Support</h3>
        <p className="text-sm text-muted-foreground">
          Animations respect user's motion preferences
        </p>
        <div className="flex gap-2">
          <Button className="motion-reduce:transition-none">
            Respects Preferences
          </Button>
          <Button variant="destructive" className="motion-reduce:transform-none">
            No Motion When Reduced
          </Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Performance optimizations and reduced motion support.',
      },
    },
  },
};