import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient' | 'gradient-destructive' | 'gradient-success';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
  loading?: boolean;
  loadingText?: string;
  gradient?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
}

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors duration-200',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors duration-200',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-200',
  ghost: 'hover:bg-accent hover:text-accent-foreground transition-colors duration-200',
  link: 'text-primary underline-offset-4 hover:underline transition-colors duration-200',
  gradient: 'bg-gradient-primary text-primary-foreground hover:bg-gradient-primary/90 transition-colors duration-200',
  'gradient-destructive': 'bg-gradient-destructive text-destructive-foreground hover:bg-gradient-destructive/90 transition-colors duration-200',
  'gradient-success': 'bg-gradient-success text-success-foreground hover:bg-gradient-success/90 transition-colors duration-200',
};

const sizes = {
  default: 'h-10 px-4 py-2 text-body-sm',
  sm: 'h-9 rounded-md px-3 text-body-xs',
  lg: 'h-11 rounded-md px-8 text-body',
  icon: 'h-10 w-10 p-0',
  'icon-sm': 'h-8 w-8 p-0',
  'icon-lg': 'h-12 w-12 p-0',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'default', 
    asChild = false, 
    loading = false,
    loadingText,
    gradient = false,
    icon: Icon,
    iconPosition = 'left',
    children,
    disabled,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    'aria-haspopup': ariaHaspopup,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;
    
    // Determine the actual variant to use
    const actualVariant = gradient ? 
      (variant === 'destructive' ? 'gradient-destructive' : 
       variant === 'secondary' ? 'gradient' : 'gradient') : 
      variant;
    
    // Dynamic icon sizing based on button size
    const getIconSize = (size: string) => {
      switch (size) {
        case 'sm':
        case 'icon-sm':
          return 'h-3.5 w-3.5';
        case 'lg':
        case 'icon-lg':
          return 'h-5 w-5';
        default:
          return 'h-4 w-4';
      }
    };

    const iconSize = getIconSize(size);
    
    const iconElement = loading ? (
      <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden="true" data-testid="loading-spinner" />
    ) : Icon ? (
      <Icon className={cn(iconSize)} aria-hidden="true" />
    ) : null;

    // Enhanced focus ring styles based on variant with improved accessibility
    const getFocusRingStyles = (variant: string) => {
      const baseRing = 'focus-visible:outline-none focus:outline-none';
      
      switch (variant) {
        case 'gradient':
        case 'default':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'destructive':
        case 'gradient-destructive':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'gradient-success':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'secondary':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'outline':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'ghost':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        case 'link':
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
        default:
          return `${baseRing} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
      }
    };

    // Enhanced disabled state styles
    const getDisabledStyles = (variant: string) => {
      const baseDisabled = 'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';
      
      switch (variant) {
        case 'gradient':
        case 'gradient-destructive':
        case 'gradient-success':
          return `${baseDisabled} disabled:shadow-none disabled:from-muted disabled:to-muted disabled:text-muted-foreground`;
        case 'outline':
          return `${baseDisabled} disabled:border-muted disabled:text-muted-foreground disabled:bg-muted/20`;
        default:
          return baseDisabled;
      }
    };

    // Enhanced ARIA attributes for better accessibility
    const getAriaAttributes = () => {
      const baseAttrs = {
        'aria-busy': loading,
        'aria-disabled': isDisabled,
        'aria-label': loading ? 
          `${ariaLabel || (typeof children === 'string' ? children : 'Botão')} - Carregando` : 
          ariaLabel,
        'aria-describedby': ariaDescribedBy,
        'aria-pressed': ariaPressed,
        'aria-expanded': ariaExpanded,
        'aria-controls': ariaControls,
        'aria-haspopup': ariaHaspopup,
      };

      // Remove undefined values to keep DOM clean
      return Object.fromEntries(
        Object.entries(baseAttrs).filter(([_, value]) => value !== undefined)
      );
    };

    return (
      <Comp
        className={cn(
          // Base styles with enhanced accessibility
          'inline-flex items-center justify-center rounded-lg font-semibold ring-offset-background',
          'transition-all duration-200 ease-in-out',
          // Enhanced keyboard navigation support
          'focus-visible:outline-none focus:outline-none',
          // Ensure proper cursor states
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
          // Reduced motion support
          'motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:hover:shadow-none',
          // Apply variant-specific styles
          getFocusRingStyles(actualVariant),
          getDisabledStyles(actualVariant),
          variants[actualVariant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={isDisabled}
        // Enhanced keyboard navigation
        tabIndex={isDisabled ? -1 : 0}
        // Enhanced ARIA attributes
        {...getAriaAttributes()}
        // Keyboard event handlers for better accessibility
        onKeyDown={(e) => {
          // Handle Enter and Space key activation
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault();
            if (props.onClick) {
              props.onClick(e as any);
            }
          }
          // Call original onKeyDown if provided
          if (props.onKeyDown) {
            props.onKeyDown(e);
          }
        }}
        {...props}
      >
        {iconElement && iconPosition === 'left' && (
          <span className={cn(
            'flex items-center shrink-0',
            children && (size === 'sm' || size === 'icon-sm' ? 'mr-1.5' : 'mr-2')
          )} aria-hidden="true">
            {iconElement}
          </span>
        )}
        
        {/* Enhanced loading state accessibility */}
        {loading && (
          <span className="sr-only" role="status" aria-live="polite">
            Carregando...
          </span>
        )}
        
        {/* Enhanced content accessibility for icon buttons */}
        {!asChild && (
          <span className={cn(
            loading && !children ? 'sr-only' : undefined,
            // Better accessibility for icon-only buttons
            (size === 'icon' || size === 'icon-sm' || size === 'icon-lg') && !children ? 'sr-only' : undefined
          )}>
            {/* Show loading text if provided, otherwise show children */}
            {loading && loadingText ? loadingText : 
             (size === 'icon' || size === 'icon-sm' || size === 'icon-lg') && !children && ariaLabel ? 
              ariaLabel : 
              children
            }
          </span>
        )}
        
        {/* For asChild, render children directly */}
        {asChild && children}
        
        {iconElement && iconPosition === 'right' && (
          <span className={cn(
            'flex items-center shrink-0',
            children && (size === 'sm' || size === 'icon-sm' ? 'ml-1.5' : 'ml-2')
          )} aria-hidden="true">
            {iconElement}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export default Button;
