import React from 'react';
import Button from './Button';
import { 
  Plus, 
  Trash2, 
  Download, 
  Settings, 
  Heart, 
  Star,
  Power,
  Pause
} from 'lucide-react';

/**
 * ButtonDemo component showcasing all the enhanced button variants and features
 * This component demonstrates the improvements made in tasks 3.1 and 3.2:
 * - Gradient variants for primary and destructive buttons
 * - Improved hover, active, and disabled states with animations
 * - Loading state support with modern spinner animations
 * - Icon button variants with proper spacing and alignment
 * - Enhanced accessibility with proper focus indicators
 * - Comprehensive ARIA attributes for screen readers
 * - Keyboard navigation support for all variants
 */
export default function ButtonDemo() {
  const [loading, setLoading] = React.useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <div className="p-8 space-y-8 bg-background">
      <div className="space-y-4">
        <h2 className="typography-h2">Enhanced Button Variants</h2>
        
        {/* Standard Variants */}
        <div className="space-y-4">
          <h3 className="typography-h3">Standard Variants</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Default Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="link">Link Button</Button>
            <Button variant="destructive">Destructive Button</Button>
          </div>
        </div>

        {/* Gradient Variants */}
        <div className="space-y-4">
          <h3 className="typography-h3">New Gradient Variants</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" />
              Gradient Primary
            </Button>
            <Button variant="gradient-success">
              <Heart className="mr-2 h-4 w-4" />
              Gradient Success
            </Button>
            <Button variant="gradient-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Gradient Destructive
            </Button>
          </div>
        </div>

        {/* Button Sizes */}
        <div className="space-y-4">
          <h3 className="typography-h3">Button Sizes</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="gradient">Small</Button>
            <Button size="default" variant="gradient">Default</Button>
            <Button size="lg" variant="gradient">Large</Button>
          </div>
        </div>

        {/* Icon Button Variants */}
        <div className="space-y-4">
          <h3 className="typography-h3">Enhanced Icon Buttons</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="icon-sm" variant="outline" aria-label="Small settings">
              <Settings />
            </Button>
            <Button size="icon" variant="gradient" aria-label="Default download">
              <Download />
            </Button>
            <Button size="icon-lg" variant="gradient-success" aria-label="Large favorite">
              <Star />
            </Button>
          </div>
        </div>

        {/* Loading States */}
        <div className="space-y-4">
          <h3 className="typography-h3">Loading States with Modern Spinners</h3>
          <div className="flex flex-wrap gap-4">
            <Button loading>Loading Default</Button>
            <Button variant="gradient" loading>Loading Gradient</Button>
            <Button variant="gradient-success" loading>Loading Success</Button>
            <Button variant="outline" loading>Loading Outline</Button>
            <Button 
              variant="gradient-destructive" 
              loading={loading}
              onClick={handleLoadingDemo}
            >
              {loading ? 'Processing...' : 'Click for Demo'}
            </Button>
          </div>
        </div>

        {/* Icon Positions */}
        <div className="space-y-4">
          <h3 className="typography-h3">Icon Positions & Spacing</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="gradient" icon={Power} iconPosition="left">
              Connect
            </Button>
            <Button variant="gradient-destructive" icon={Pause} iconPosition="right">
              Disconnect
            </Button>
            <Button variant="outline" icon={Settings} iconPosition="left" size="sm">
              Settings
            </Button>
            <Button variant="gradient-success" icon={Download} iconPosition="right" size="lg">
              Download
            </Button>
          </div>
        </div>

        {/* Disabled States */}
        <div className="space-y-4">
          <h3 className="typography-h3">Enhanced Disabled States</h3>
          <div className="flex flex-wrap gap-4">
            <Button disabled>Disabled Default</Button>
            <Button variant="gradient" disabled>Disabled Gradient</Button>
            <Button variant="gradient-success" disabled>Disabled Success</Button>
            <Button variant="outline" disabled>Disabled Outline</Button>
            <Button variant="gradient-destructive" disabled icon={Trash2}>
              Disabled Destructive
            </Button>
          </div>
        </div>

        {/* Accessibility Features Demo */}
        <div className="space-y-4">
          <h3 className="typography-h3">Enhanced Accessibility Features</h3>
          <p className="typography-body-sm typography-muted">
            These buttons demonstrate improved accessibility with focus indicators, ARIA attributes, and keyboard navigation:
          </p>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="gradient" 
              aria-label="Save document"
              aria-describedby="save-help"
            >
              Save
            </Button>
            <Button 
              variant="outline" 
              aria-pressed={false}
              aria-label="Toggle favorite status"
            >
              <Star className="mr-2 h-4 w-4" />
              Favorite
            </Button>
            <Button 
              variant="gradient-success" 
              aria-expanded={false}
              aria-haspopup="menu"
              aria-controls="menu-options"
            >
              Options
            </Button>
            <Button 
              size="icon" 
              variant="outline"
              aria-label="Open settings menu"
              aria-describedby="settings-help"
            >
              <Settings />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p id="save-help">Saves the current document to your account</p>
            <p id="settings-help">Opens the application settings panel</p>
          </div>
        </div>

        {/* Keyboard Navigation Demo */}
        <div className="space-y-4">
          <h3 className="typography-h3">Keyboard Navigation Support</h3>
          <p className="typography-body-sm typography-muted">
            Use Tab to navigate, Enter or Space to activate. Notice the enhanced focus rings:
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Tab to me</Button>
            <Button variant="gradient">Press Enter</Button>
            <Button variant="outline">Or Space</Button>
            <Button variant="gradient-success">Focus visible</Button>
            <Button variant="link">Link style focus</Button>
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="space-y-4">
          <h3 className="typography-h3">Interactive Hover & Active States</h3>
          <p className="typography-body-sm typography-muted">
            Hover over and click these buttons to see the enhanced animations and transitions:
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="gradient">Hover Me!</Button>
            <Button variant="gradient-success">Click Me!</Button>
            <Button variant="outline">Try Hover!</Button>
            <Button variant="gradient-destructive">Active State!</Button>
          </div>
        </div>
      </div>
    </div>
  );
}