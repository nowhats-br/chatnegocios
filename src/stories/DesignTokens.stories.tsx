import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Design System/Design Tokens',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Design Tokens

Our design system is built on a foundation of design tokens that ensure consistency across all components and interfaces.

## Token Categories

- **Colors**: Primary, secondary, status, and semantic colors
- **Typography**: Font families, sizes, weights, and line heights
- **Spacing**: Consistent spacing scale for margins, padding, and gaps
- **Shadows**: Elevation system with subtle shadow variations
- **Border Radius**: Consistent corner radius values
- **Animations**: Timing functions and duration values

## Usage

Design tokens are implemented as CSS custom properties and Tailwind CSS utilities, making them easy to use and maintain across the entire application.
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Color Palette</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="typography-h3">Primary Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <div key={shade} className="space-y-2">
                  <div 
                    className={`w-full h-16 rounded-lg border border-border`}
                    style={{ backgroundColor: `hsl(var(--primary-${shade}))` }}
                  />
                  <div className="text-center">
                    <div className="typography-caption font-medium">Primary {shade}</div>
                    <div className="typography-caption text-muted-foreground">
                      --primary-{shade}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="typography-h3">Status Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Success', var: '--success', class: 'bg-success' },
                { name: 'Warning', var: '--warning', class: 'bg-warning' },
                { name: 'Error', var: '--error', class: 'bg-error' },
                { name: 'Info', var: '--info', class: 'bg-info' },
              ].map((color) => (
                <div key={color.name} className="space-y-2">
                  <div className={`w-full h-16 rounded-lg border border-border ${color.class}`} />
                  <div className="text-center">
                    <div className="typography-caption font-medium">{color.name}</div>
                    <div className="typography-caption text-muted-foreground">{color.var}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="typography-h3">Semantic Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Background', class: 'bg-background border-2 border-border' },
                { name: 'Card', class: 'bg-card border border-border' },
                { name: 'Muted', class: 'bg-muted' },
                { name: 'Accent', class: 'bg-accent' },
              ].map((color) => (
                <div key={color.name} className="space-y-2">
                  <div className={`w-full h-16 rounded-lg ${color.class}`} />
                  <div className="text-center">
                    <div className="typography-caption font-medium">{color.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Typography Scale</h2>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="typography-h3">Headings</h3>
            <div className="space-y-4">
              <div className="flex items-baseline gap-4">
                <div className="typography-display">Display</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-display • clamp(2.5rem, 5vw, 3.5rem) • 700
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-h1">Heading 1</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-h1 • clamp(2rem, 4vw, 2.5rem) • 600
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-h2">Heading 2</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-h2 • clamp(1.75rem, 3.5vw, 2rem) • 600
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-h3">Heading 3</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-h3 • clamp(1.25rem, 2.5vw, 1.5rem) • 600
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="typography-h3">Body Text</h3>
            <div className="space-y-4">
              <div className="flex items-baseline gap-4">
                <div className="typography-lead">Lead text for important content</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-lead • clamp(1.125rem, 1.75vw, 1.25rem) • 400
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-body-lg">Large body text</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-body-lg • clamp(1.125rem, 1.5vw, 1.25rem) • 400
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-body">Regular body text</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-body • clamp(0.875rem, 1.25vw, 1rem) • 400
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-body-sm">Small body text</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-body-sm • clamp(0.75rem, 1vw, 0.875rem) • 400
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="typography-caption">Caption text</div>
                <div className="typography-caption text-muted-foreground">
                  .typography-caption • clamp(0.6875rem, 0.875vw, 0.75rem) • 500
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Spacing Scale</h2>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="typography-h3">Base Spacing Units</h3>
            <div className="space-y-3">
              {[
                { name: 'space-1', value: '4px', var: '--space-1' },
                { name: 'space-2', value: '8px', var: '--space-2' },
                { name: 'space-3', value: '12px', var: '--space-3' },
                { name: 'space-4', value: '16px', var: '--space-4' },
                { name: 'space-6', value: '24px', var: '--space-6' },
                { name: 'space-8', value: '32px', var: '--space-8' },
                { name: 'space-12', value: '48px', var: '--space-12' },
                { name: 'space-16', value: '64px', var: '--space-16' },
              ].map((space) => (
                <div key={space.name} className="flex items-center gap-4">
                  <div className="w-20 typography-caption font-medium">{space.name}</div>
                  <div 
                    className="bg-primary h-4 rounded"
                    style={{ width: space.value }}
                  />
                  <div className="typography-caption text-muted-foreground">
                    {space.value} • {space.var}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="typography-h3">Responsive Spacing</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="typography-body-sm font-medium">Gap Responsive Small</div>
                <div className="flex gap-responsive-sm">
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="typography-body-sm font-medium">Gap Responsive Medium</div>
                <div className="flex gap-responsive-md">
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="typography-body-sm font-medium">Gap Responsive Large</div>
                <div className="flex gap-responsive-lg">
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                  <div className="w-12 h-12 bg-primary/20 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Shadows: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Shadow Scale</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: 'Small', class: 'shadow-sm', var: '--shadow-sm' },
            { name: 'Medium', class: 'shadow-md', var: '--shadow-md' },
            { name: 'Large', class: 'shadow-lg', var: '--shadow-lg' },
            { name: 'Extra Large', class: 'shadow-xl', var: '--shadow-xl' },
          ].map((shadow) => (
            <div key={shadow.name} className="space-y-3">
              <div className={`w-full h-24 bg-card border border-border rounded-lg ${shadow.class}`} />
              <div className="text-center">
                <div className="typography-body-sm font-medium">{shadow.name}</div>
                <div className="typography-caption text-muted-foreground">{shadow.var}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

export const BorderRadius: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Border Radius Scale</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            { name: 'Small', class: 'rounded-sm', var: '--radius-sm', value: '6px' },
            { name: 'Medium', class: 'rounded-md', var: '--radius-md', value: '8px' },
            { name: 'Large', class: 'rounded-lg', var: '--radius-lg', value: '12px' },
            { name: 'Extra Large', class: 'rounded-xl', var: '--radius-xl', value: '16px' },
            { name: '2X Large', class: 'rounded-2xl', var: '--radius-2xl', value: '24px' },
          ].map((radius) => (
            <div key={radius.name} className="space-y-3">
              <div className={`w-full h-20 bg-primary/20 border border-border ${radius.class}`} />
              <div className="text-center">
                <div className="typography-body-sm font-medium">{radius.name}</div>
                <div className="typography-caption text-muted-foreground">
                  {radius.value} • {radius.var}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

export const Animations: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="typography-h2">Animation Tokens</h2>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="typography-h3">Timing Functions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="typography-body-sm font-medium">Ease Out (Default)</div>
                <div className="w-full h-12 bg-primary/20 rounded transition-all duration-300 ease-out hover:bg-primary/40 hover:scale-105 cursor-pointer" />
                <div className="typography-caption text-muted-foreground">
                  cubic-bezier(0.4, 0, 0.2, 1)
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="typography-body-sm font-medium">Ease In Out</div>
                <div className="w-full h-12 bg-primary/20 rounded transition-all duration-300 ease-in-out hover:bg-primary/40 hover:scale-105 cursor-pointer" />
                <div className="typography-caption text-muted-foreground">
                  cubic-bezier(0.4, 0, 0.6, 1)
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="typography-h3">Duration Scale</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Fast', duration: '150ms', class: 'duration-150' },
                { name: 'Normal', duration: '200ms', class: 'duration-200' },
                { name: 'Slow', duration: '300ms', class: 'duration-300' },
              ].map((timing) => (
                <div key={timing.name} className="space-y-3">
                  <div className="typography-body-sm font-medium">{timing.name}</div>
                  <div className={`w-full h-12 bg-primary/20 rounded transition-all ${timing.class} ease-out hover:bg-primary/40 hover:scale-105 cursor-pointer`} />
                  <div className="typography-caption text-muted-foreground">
                    {timing.duration} • .{timing.class}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="typography-h3">Status Animations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="typography-body-sm font-medium">Status Pulse</div>
                <div className="w-12 h-12 bg-primary rounded-full animate-status-pulse mx-auto" />
                <div className="typography-caption text-muted-foreground text-center">
                  .animate-status-pulse
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="typography-body-sm font-medium">Status Glow</div>
                <div className="w-12 h-12 bg-success rounded-full animate-status-glow mx-auto" />
                <div className="typography-caption text-muted-foreground text-center">
                  .animate-status-glow
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="typography-body-sm font-medium">Status Bounce</div>
                <div className="w-12 h-12 bg-warning rounded-full animate-status-bounce mx-auto" />
                <div className="typography-caption text-muted-foreground text-center">
                  .animate-status-bounce
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};