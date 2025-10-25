import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ConnectionCard } from './ConnectionCard';

// Mock connection data for different states
const baseConnection = {
  id: '1',
  name: 'vendas-principal',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  instance_data: {
    owner: '5511999999999@c.us',
    pushName: 'Vendas Principal'
  }
};

const connections = {
  connected: { ...baseConnection, status: 'connected' as const },
  disconnected: { ...baseConnection, status: 'disconnected' as const, id: '2', name: 'suporte-tecnico' },
  paused: { ...baseConnection, status: 'paused' as const, id: '3', name: 'atendimento-geral' },
  connecting: { ...baseConnection, status: 'disconnected' as const, id: '4', name: 'vendas-secundaria' },
};

const meta = {
  title: 'UI/ConnectionCard',
  component: ConnectionCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# ConnectionCard Component

A professional card component for displaying WhatsApp connection instances with modern styling and comprehensive interaction support.

## Features

- **Status Indicators**: Visual status badges with appropriate colors and animations
- **Action Buttons**: Context-aware buttons based on connection state
- **Loading States**: Comprehensive loading feedback for all actions
- **Accessibility**: Full keyboard navigation and screen reader support
- **Responsive Design**: Optimized for all screen sizes
- **Performance**: GPU-accelerated animations with reduced motion support

## Connection States

- **Connected**: Active connection with disconnect and pause options
- **Disconnected**: Inactive connection with connect and QR code options
- **Paused**: Temporarily paused connection with resume option
- **Connecting**: Transitional state with animated indicators

## Design Tokens

The component uses our design system tokens for:
- Status colors and indicators
- Card elevation and shadows
- Button styling and interactions
- Typography hierarchy
- Spacing and layout
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    connection: {
      description: 'Connection data object',
      control: { type: 'object' },
    },
    isConnecting: {
      control: { type: 'boolean' },
      description: 'Shows connecting state with animated indicators',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Disables all buttons and shows loading states',
    },
    onConnect: { action: 'connect' },
    onDisconnect: { action: 'disconnect' },
    onPause: { action: 'pause' },
    onResume: { action: 'resume' },
    onDelete: { action: 'delete' },
    onShowQR: { action: 'showQR' },
  },
  args: {
    onConnect: fn(),
    onDisconnect: fn(),
    onPause: fn(),
    onResume: fn(),
    onDelete: fn(),
    onShowQR: fn(),
  },
} satisfies Meta<typeof ConnectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic states
export const Connected: Story = {
  args: {
    connection: connections.connected,
    isConnecting: false,
    isLoading: false,
  },
};

export const Disconnected: Story = {
  args: {
    connection: connections.disconnected,
    isConnecting: false,
    isLoading: false,
  },
};

export const Paused: Story = {
  args: {
    connection: connections.paused,
    isConnecting: false,
    isLoading: false,
  },
};

export const Connecting: Story = {
  args: {
    connection: connections.connecting,
    isConnecting: true,
    isLoading: false,
  },
};

// Loading states
export const LoadingState: Story = {
  args: {
    connection: connections.connected,
    isConnecting: false,
    isLoading: true,
  },
};

export const ConnectingWithLoading: Story = {
  args: {
    connection: connections.connecting,
    isConnecting: true,
    isLoading: true,
  },
};

// Interactive examples
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 max-w-6xl">
      <ConnectionCard
        connection={connections.connected}
        onConnect={fn()}
        onDisconnect={fn()}
        onPause={fn()}
        onResume={fn()}
        onDelete={fn()}
        onShowQR={fn()}
        isConnecting={false}
        isLoading={false}
      />
      <ConnectionCard
        connection={connections.disconnected}
        onConnect={fn()}
        onDisconnect={fn()}
        onPause={fn()}
        onResume={fn()}
        onDelete={fn()}
        onShowQR={fn()}
        isConnecting={false}
        isLoading={false}
      />
      <ConnectionCard
        connection={connections.paused}
        onConnect={fn()}
        onDisconnect={fn()}
        onPause={fn()}
        onResume={fn()}
        onDelete={fn()}
        onShowQR={fn()}
        isConnecting={false}
        isLoading={false}
      />
      <ConnectionCard
        connection={connections.connecting}
        onConnect={fn()}
        onDisconnect={fn()}
        onPause={fn()}
        onResume={fn()}
        onDelete={fn()}
        onShowQR={fn()}
        isConnecting={true}
        isLoading={false}
      />
      <ConnectionCard
        connection={connections.connected}
        onConnect={fn()}
        onDisconnect={fn()}
        onPause={fn()}
        onResume={fn()}
        onDelete={fn()}
        onShowQR={fn()}
        isConnecting={false}
        isLoading={true}
      />
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'All connection card states displayed in a responsive grid layout.',
      },
    },
  },
};

export const StatusIndicators: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Status Indicators</h3>
        <p className="text-sm text-muted-foreground">
          Each status has distinct colors and animations
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h4 className="font-medium">Static States</h4>
          <div className="space-y-3">
            <ConnectionCard
              connection={connections.connected}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
            <ConnectionCard
              connection={connections.disconnected}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
            <ConnectionCard
              connection={connections.paused}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium">Animated States</h4>
          <div className="space-y-3">
            <ConnectionCard
              connection={connections.connecting}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={true}
              isLoading={false}
            />
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of different status indicators and their visual treatments.',
      },
    },
  },
};

export const ResponsiveLayout: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Responsive Grid Layout</h3>
        <p className="text-sm text-muted-foreground">
          Cards adapt to different screen sizes with optimal spacing
        </p>
      </div>
      
      <div className="grid-responsive-cards gap-responsive-md">
        {Object.values(connections).map((connection, index) => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            onConnect={fn()}
            onDisconnect={fn()}
            onPause={fn()}
            onResume={fn()}
            onDelete={fn()}
            onShowQR={fn()}
            isConnecting={index === 3}
            isLoading={false}
          />
        ))}
        {/* Add more cards to demonstrate grid behavior */}
        <ConnectionCard
          connection={{
            ...baseConnection,
            id: '5',
            name: 'marketing-digital',
            status: 'connected'
          }}
          onConnect={fn()}
          onDisconnect={fn()}
          onPause={fn()}
          onResume={fn()}
          onDelete={fn()}
          onShowQR={fn()}
          isConnecting={false}
          isLoading={false}
        />
        <ConnectionCard
          connection={{
            ...baseConnection,
            id: '6',
            name: 'financeiro',
            status: 'disconnected'
          }}
          onConnect={fn()}
          onDisconnect={fn()}
          onPause={fn()}
          onResume={fn()}
          onDelete={fn()}
          onShowQR={fn()}
          isConnecting={false}
          isLoading={false}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Responsive grid layout demonstration with multiple cards.',
      },
    },
  },
};

export const AccessibilityDemo: Story = {
  render: () => (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Accessibility Features</h3>
        <p className="text-sm text-muted-foreground">
          Full keyboard navigation and screen reader support
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Keyboard Navigation</h4>
          <p className="text-xs text-muted-foreground">
            Use Tab to navigate between cards and buttons, Enter/Space to activate
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConnectionCard
              connection={connections.connected}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
            <ConnectionCard
              connection={connections.disconnected}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-medium">Screen Reader Announcements</h4>
          <p className="text-xs text-muted-foreground">
            Status changes and button actions are announced to screen readers
          </p>
          <ConnectionCard
            connection={connections.connecting}
            onConnect={fn()}
            onDisconnect={fn()}
            onPause={fn()}
            onResume={fn()}
            onDelete={fn()}
            onShowQR={fn()}
            isConnecting={true}
            isLoading={false}
          />
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

export const PerformanceDemo: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Performance Optimizations</h3>
        <p className="text-sm text-muted-foreground">
          GPU-accelerated animations with reduced motion support
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Smooth Animations</h4>
          <p className="text-xs text-muted-foreground">
            Hover over cards to see optimized transform animations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConnectionCard
              connection={connections.connected}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
            <ConnectionCard
              connection={connections.paused}
              onConnect={fn()}
              onDisconnect={fn()}
              onPause={fn()}
              onResume={fn()}
              onDelete={fn()}
              onShowQR={fn()}
              isConnecting={false}
              isLoading={false}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-medium">Connecting Animation</h4>
          <p className="text-xs text-muted-foreground">
            Animated status indicators for connecting states
          </p>
          <ConnectionCard
            connection={connections.connecting}
            onConnect={fn()}
            onDisconnect={fn()}
            onPause={fn()}
            onResume={fn()}
            onDelete={fn()}
            onShowQR={fn()}
            isConnecting={true}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Performance optimizations and animation demonstrations.',
      },
    },
  },
};

// Edge cases and error states
export const EdgeCases: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Edge Cases</h3>
        <p className="text-sm text-muted-foreground">
          Handling of missing data and edge cases
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConnectionCard
          connection={{
            id: 'no-phone',
            name: 'sem-telefone',
            status: 'connected',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            instance_data: {} // No phone number
          }}
          onConnect={fn()}
          onDisconnect={fn()}
          onPause={fn()}
          onResume={fn()}
          onDelete={fn()}
          onShowQR={fn()}
          isConnecting={false}
          isLoading={false}
        />
        
        <ConnectionCard
          connection={{
            id: 'long-name',
            name: 'conexao-com-nome-muito-longo-para-testar-quebra-de-linha',
            status: 'disconnected',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            instance_data: {
              owner: '5511999999999@c.us',
              pushName: 'Nome Muito Longo Para Testar'
            }
          }}
          onConnect={fn()}
          onDisconnect={fn()}
          onPause={fn()}
          onResume={fn()}
          onDelete={fn()}
          onShowQR={fn()}
          isConnecting={false}
          isLoading={false}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Edge cases including missing phone numbers and long names.',
      },
    },
  },
};