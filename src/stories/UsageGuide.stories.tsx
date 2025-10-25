import type { Meta, StoryObj } from '@storybook/react';
import Button from '../components/ui/Button';
import ConnectionCard from '../components/ui/ConnectionCard';
import { Plus, Settings, Trash2 } from 'lucide-react';

const meta = {
  title: 'Design System/Usage Guide',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Usage Guide

This guide demonstrates how to use our modernized UI components effectively in different contexts and layouts.

## Component Composition

Learn how to combine components to create cohesive interfaces that follow our design system principles.

## Best Practices

- Use consistent spacing and typography
- Follow accessibility guidelines
- Implement proper loading and error states
- Respect user motion preferences
- Maintain visual hierarchy

## Performance Considerations

- Use GPU-accelerated animations
- Implement proper focus management
- Optimize for different screen sizes
- Support reduced motion preferences
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for examples
const mockConnections = [
  {
    id: '1',
    name: 'vendas-principal',
    status: 'connected' as const,
    instance_data: { owner: '5511999999999@c.us', pushName: 'Vendas Principal' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'suporte-tecnico',
    status: 'disconnected' as const,
    instance_data: { owner: '5511888888888@c.us', pushName: 'Suporte Técnico' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'atendimento-geral',
    status: 'paused' as const,
    instance_data: { owner: '5511777777777@c.us', pushName: 'Atendimento Geral' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

export const PageLayout: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container-responsive header-responsive">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="typography-h1">Conexões WhatsApp</h1>
              <p className="typography-body text-muted-foreground">
                Gerencie suas instâncias de WhatsApp Business
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" icon={Settings} iconPosition="left">
                Configurações
              </Button>
              <Button icon={Plus} iconPosition="left" gradient>
                Nova Conexão
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container-responsive py-8">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="typography-body-sm text-muted-foreground">Conectadas</p>
                  <p className="typography-h2 text-success">1</p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 bg-success rounded-full" />
                </div>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="typography-body-sm text-muted-foreground">Desconectadas</p>
                  <p className="typography-h2 text-error">1</p>
                </div>
                <div className="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 bg-error rounded-full" />
                </div>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="typography-body-sm text-muted-foreground">Pausadas</p>
                  <p className="typography-h2 text-warning">1</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 bg-warning rounded-full" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Connection Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="typography-h2">Suas Conexões</h2>
              <Button variant="ghost" size="sm">
                Atualizar Lista
              </Button>
            </div>
            
            <div className="grid-responsive-cards gap-responsive-md">
              {mockConnections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  onConnect={() => {}}
                  onDisconnect={() => {}}
                  onPause={() => {}}
                  onResume={() => {}}
                  onDelete={() => {}}
                  onShowQR={() => {}}
                  isConnecting={false}
                  isLoading={false}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete page layout demonstrating proper component composition and spacing.',
      },
    },
  },
};

export const ButtonComposition: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Button Composition Patterns</h2>
        
        <div className="space-y-6">
          {/* Primary Actions */}
          <div className="space-y-3">
            <h3 className="typography-h3">Primary Actions</h3>
            <p className="typography-body text-muted-foreground">
              Use gradient primary buttons for the most important actions
            </p>
            <div className="flex flex-wrap gap-3">
              <Button gradient icon={Plus} iconPosition="left">
                Criar Nova Conexão
              </Button>
              <Button variant="outline">
                Importar Configuração
              </Button>
              <Button variant="ghost" icon={Settings} size="icon" aria-label="Configurações" />
            </div>
          </div>
          
          {/* Destructive Actions */}
          <div className="space-y-3">
            <h3 className="typography-h3">Destructive Actions</h3>
            <p className="typography-body text-muted-foreground">
              Use destructive variants for dangerous actions with clear confirmation
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" icon={Trash2} iconPosition="left">
                Excluir Conexão
              </Button>
              <Button variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
          
          {/* Loading States */}
          <div className="space-y-3">
            <h3 className="typography-h3">Loading States</h3>
            <p className="typography-body text-muted-foreground">
              Provide clear feedback during async operations
            </p>
            <div className="flex flex-wrap gap-3">
              <Button loading loadingText="Conectando...">
                Conectar
              </Button>
              <Button variant="destructive" loading loadingText="Excluindo...">
                Excluir
              </Button>
              <Button variant="outline" loading>
                Carregando
              </Button>
            </div>
          </div>
          
          {/* Button Groups */}
          <div className="space-y-3">
            <h3 className="typography-h3">Button Groups</h3>
            <p className="typography-body text-muted-foreground">
              Group related actions with consistent spacing
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Conectar</Button>
              <Button size="sm" variant="outline">Pausar</Button>
              <Button size="sm" variant="ghost">QR Code</Button>
              <Button size="sm" variant="destructive">Excluir</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common button composition patterns and usage guidelines.',
      },
    },
  },
};

export const ResponsivePatterns: Story = {
  render: () => (
    <div className="space-y-8">
      {/* Mobile Layout */}
      <div className="space-y-4">
        <h2 className="typography-h2 p-4">Mobile-First Responsive Design</h2>
        
        <div className="bg-muted/30 p-4 rounded-lg">
          <div className="space-y-4">
            <h3 className="typography-h3">Mobile Layout (&lt; 640px)</h3>
            <div className="max-w-sm mx-auto space-y-4">
              {/* Mobile Header */}
              <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                <h4 className="typography-h4">Conexões</h4>
                <Button size="sm" icon={Plus} aria-label="Adicionar" />
              </div>
              
              {/* Mobile Cards - Single Column */}
              <div className="space-y-3">
                {mockConnections.slice(0, 2).map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    onPause={() => {}}
                    onResume={() => {}}
                    onDelete={() => {}}
                    onShowQR={() => {}}
                    isConnecting={false}
                    isLoading={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tablet Layout */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <div className="space-y-4">
            <h3 className="typography-h3">Tablet Layout (640px - 1024px)</h3>
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Tablet Header */}
              <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                <div>
                  <h4 className="typography-h4">Conexões WhatsApp</h4>
                  <p className="typography-body-sm text-muted-foreground">
                    Gerencie suas instâncias
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Atualizar</Button>
                  <Button size="sm" icon={Plus} iconPosition="left">Adicionar</Button>
                </div>
              </div>
              
              {/* Tablet Cards - Two Columns */}
              <div className="grid grid-cols-2 gap-4">
                {mockConnections.map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    onPause={() => {}}
                    onResume={() => {}}
                    onDelete={() => {}}
                    onShowQR={() => {}}
                    isConnecting={false}
                    isLoading={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Desktop Layout */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <div className="space-y-4">
            <h3 className="typography-h3">Desktop Layout (&gt; 1024px)</h3>
            <div className="space-y-4">
              {/* Desktop Header */}
              <div className="flex items-center justify-between p-6 bg-card rounded-lg">
                <div>
                  <h4 className="typography-h2">Conexões WhatsApp Business</h4>
                  <p className="typography-body text-muted-foreground">
                    Gerencie todas as suas instâncias de WhatsApp em um só lugar
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" icon={Settings} iconPosition="left">
                    Configurações
                  </Button>
                  <Button icon={Plus} iconPosition="left" gradient>
                    Nova Conexão
                  </Button>
                </div>
              </div>
              
              {/* Desktop Cards - Three Columns */}
              <div className="grid grid-cols-3 gap-6">
                {mockConnections.map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    onPause={() => {}}
                    onResume={() => {}}
                    onDelete={() => {}}
                    onShowQR={() => {}}
                    isConnecting={false}
                    isLoading={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Responsive design patterns showing how components adapt to different screen sizes.',
      },
    },
  },
};

export const AccessibilityPatterns: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Accessibility Best Practices</h2>
        
        <div className="space-y-6">
          {/* Keyboard Navigation */}
          <div className="space-y-3">
            <h3 className="typography-h3">Keyboard Navigation</h3>
            <p className="typography-body text-muted-foreground">
              All interactive elements support keyboard navigation
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <p className="typography-body-sm">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> to navigate, 
                  <kbd className="px-2 py-1 bg-muted rounded text-xs ml-1">Enter</kbd> or 
                  <kbd className="px-2 py-1 bg-muted rounded text-xs ml-1">Space</kbd> to activate
                </p>
                <div className="flex gap-2">
                  <Button>First Button</Button>
                  <Button variant="outline">Second Button</Button>
                  <Button disabled>Disabled (Skipped)</Button>
                  <Button variant="destructive">Last Button</Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Screen Reader Support */}
          <div className="space-y-3">
            <h3 className="typography-h3">Screen Reader Support</h3>
            <p className="typography-body text-muted-foreground">
              Proper ARIA labels and semantic markup
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    icon={Plus} 
                    size="icon" 
                    aria-label="Adicionar nova conexão"
                  />
                  <Button 
                    loading 
                    loadingText="Processando..."
                    aria-describedby="processing-desc"
                  >
                    Salvar
                  </Button>
                  <span id="processing-desc" className="sr-only">
                    Aguarde enquanto processamos sua solicitação
                  </span>
                </div>
                
                <ConnectionCard
                  connection={mockConnections[0]}
                  onConnect={() => {}}
                  onDisconnect={() => {}}
                  onPause={() => {}}
                  onResume={() => {}}
                  onDelete={() => {}}
                  onShowQR={() => {}}
                  isConnecting={false}
                  isLoading={false}
                />
              </div>
            </div>
          </div>
          
          {/* Focus Management */}
          <div className="space-y-3">
            <h3 className="typography-h3">Focus Management</h3>
            <p className="typography-body text-muted-foreground">
              Clear focus indicators and proper focus order
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <p className="typography-body-sm">
                  Focus indicators are clearly visible and meet WCAG contrast requirements
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Button className="focus-ring-enhanced">Enhanced Focus</Button>
                  <Button variant="destructive" className="focus-ring-destructive">
                    Destructive Focus
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Accessibility patterns and best practices for inclusive design.',
      },
    },
  },
};

export const PerformancePatterns: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Performance Optimization Patterns</h2>
        
        <div className="space-y-6">
          {/* GPU Acceleration */}
          <div className="space-y-3">
            <h3 className="typography-h3">GPU-Accelerated Animations</h3>
            <p className="typography-body text-muted-foreground">
              Smooth animations using transform and opacity
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <p className="typography-body-sm">
                  Hover over elements to see optimized animations
                </p>
                <div className="flex gap-4">
                  <Button className="animate-optimized-hover">
                    Optimized Hover
                  </Button>
                  <div className="w-16 h-16 bg-primary/20 rounded-lg animate-optimized-hover cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Reduced Motion */}
          <div className="space-y-3">
            <h3 className="typography-h3">Reduced Motion Support</h3>
            <p className="typography-body text-muted-foreground">
              Respects user motion preferences
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <p className="typography-body-sm">
                  Animations are disabled when users prefer reduced motion
                </p>
                <div className="flex gap-4">
                  <Button className="motion-reduce:transition-none">
                    Respects Preferences
                  </Button>
                  <ConnectionCard
                    connection={mockConnections[0]}
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    onPause={() => {}}
                    onResume={() => {}}
                    onDelete={() => {}}
                    onShowQR={() => {}}
                    isConnecting={false}
                    isLoading={false}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Loading States */}
          <div className="space-y-3">
            <h3 className="typography-h3">Optimized Loading States</h3>
            <p className="typography-body text-muted-foreground">
              Efficient loading indicators and skeleton states
            </p>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Button loading>Loading Button</Button>
                  <Button loading loadingText="Saving..." variant="outline">
                    Save Changes
                  </Button>
                </div>
                
                <ConnectionCard
                  connection={mockConnections[1]}
                  onConnect={() => {}}
                  onDisconnect={() => {}}
                  onPause={() => {}}
                  onResume={() => {}}
                  onDelete={() => {}}
                  onShowQR={() => {}}
                  isConnecting={true}
                  isLoading={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Performance optimization patterns for smooth user experiences.',
      },
    },
  },
};