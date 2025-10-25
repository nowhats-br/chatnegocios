import React from 'react';
import { cn } from '@/lib/utils';
import StatusBadge, { StatusType } from './StatusBadge';
import StatusIndicator from './StatusIndicator';

interface StatusSystemProps {
  status: StatusType;
  layout?: 'horizontal' | 'vertical' | 'compact';
  showAccentBar?: boolean;
  showPulse?: boolean;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'prominent';
  className?: string;
  children?: React.ReactNode;
}

/**
 * StatusSystem - A comprehensive status display component that combines
 * accent bars, indicators, and badges for a complete status visualization
 */
const StatusSystem: React.FC<StatusSystemProps> = ({
  status,
  layout = 'horizontal',
  showAccentBar = true,
  showPulse = true,
  showIcon = true,
  showText = true,
  size = 'md',
  variant = 'default',
  className,
  children,
}) => {
  const layoutClasses = {
    horizontal: 'flex items-center gap-3',
    vertical: 'flex flex-col gap-2',
    compact: 'flex items-center gap-1.5',
  };

  return (
    <div className={cn('relative', layoutClasses[layout], className)}>
      {/* Accent bar indicator */}
      {showAccentBar && (
        <StatusIndicator
          status={status}
          variant="accent-bar"
          size={size}
          showAnimation={showPulse}
          className={cn(
            layout === 'horizontal' && 'absolute left-0 top-0 h-full',
            layout === 'vertical' && 'w-full h-1',
            layout === 'compact' && 'h-4 w-1'
          )}
        />
      )}

      {/* Main content area */}
      <div className={cn(
        'flex-1',
        showAccentBar && layout === 'horizontal' && 'ml-4',
        showAccentBar && layout === 'vertical' && 'mt-2'
      )}>
        {children}
      </div>

      {/* Status badge/indicator */}
      <div className="flex items-center gap-2">
        {showIcon && !showText && (
          <StatusIndicator
            status={status}
            variant="icon"
            size={size}
            showAnimation={showPulse}
          />
        )}
        
        {(showIcon && showText) && (
          <StatusBadge
            status={status}
            size={size}
            showText={showText}
            showPulse={showPulse}
            variant={variant}
          />
        )}
        
        {!showIcon && showText && (
          <span className={cn(
            'font-medium',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusSystem;
export type { StatusSystemProps };