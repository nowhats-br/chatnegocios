import React from 'react';
import { CheckCircle, Loader2, Pause, AlertCircle, Wifi, WifiOff, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusType } from './StatusBadge';

interface StatusIndicatorConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
  text: string;
  pulseColor?: string;
  animated?: boolean;
  accentColor?: string;
}

const STATUS_INDICATOR_CONFIGS: Record<StatusType, StatusIndicatorConfig> = {
  connected: {
    color: 'text-success dark:text-success',
    bgColor: 'bg-success/10 dark:bg-success/10',
    borderColor: 'border-success/20 dark:border-success/30',
    pulseColor: 'bg-success/30',
    accentColor: 'bg-success',
    icon: CheckCircle,
    text: 'Conectado',
  },
  connecting: {
    color: 'text-info dark:text-info',
    bgColor: 'bg-info/10 dark:bg-info/10',
    borderColor: 'border-info/20 dark:border-info/30',
    pulseColor: 'bg-info/30',
    accentColor: 'bg-info',
    icon: Loader2,
    text: 'Conectando...',
    animated: true,
  },
  initializing: {
    color: 'text-primary-500 dark:text-primary-400',
    bgColor: 'bg-primary-500/10 dark:bg-primary-400/10',
    borderColor: 'border-primary-500/20 dark:border-primary-400/30',
    pulseColor: 'bg-primary-500/30',
    accentColor: 'bg-primary-500',
    icon: Wifi,
    text: 'Inicializando...',
    animated: true,
  },
  disconnected: {
    color: 'text-error dark:text-error',
    bgColor: 'bg-error/10 dark:bg-error/10',
    borderColor: 'border-error/20 dark:border-error/30',
    pulseColor: 'bg-error/30',
    accentColor: 'bg-error',
    icon: WifiOff,
    text: 'Desconectado',
  },
  paused: {
    color: 'text-warning dark:text-warning',
    bgColor: 'bg-warning/10 dark:bg-warning/10',
    borderColor: 'border-warning/20 dark:border-warning/30',
    pulseColor: 'bg-warning/30',
    accentColor: 'bg-warning',
    icon: Pause,
    text: 'Pausado',
  },
  error: {
    color: 'text-error dark:text-error',
    bgColor: 'bg-error/10 dark:bg-error/10',
    borderColor: 'border-error/20 dark:border-error/30',
    pulseColor: 'bg-error/30',
    accentColor: 'bg-error',
    icon: AlertCircle,
    text: 'Erro',
  },
};

interface StatusIndicatorProps {
  status: StatusType;
  variant?: 'dot' | 'icon' | 'full' | 'accent-bar';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
  showAnimation?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  variant = 'full',
  size = 'md',
  showText = true,
  showAnimation = true,
  className,
}) => {
  const config = STATUS_INDICATOR_CONFIGS[status];
  const Icon = config.icon;

  const sizeClasses = {
    xs: {
      dot: 'h-1.5 w-1.5',
      icon: 'h-3 w-3',
      container: 'text-xs gap-1',
      accent: 'w-0.5',
    },
    sm: {
      dot: 'h-2 w-2',
      icon: 'h-3.5 w-3.5',
      container: 'text-xs gap-1.5',
      accent: 'w-1',
    },
    md: {
      dot: 'h-2.5 w-2.5',
      icon: 'h-4 w-4',
      container: 'text-sm gap-2',
      accent: 'w-1',
    },
    lg: {
      dot: 'h-3 w-3',
      icon: 'h-5 w-5',
      container: 'text-base gap-2.5',
      accent: 'w-1.5',
    },
  };

  const sizeConfig = sizeClasses[size];

  // Dot variant - simple colored dot
  if (variant === 'dot') {
    return (
      <div className={cn('relative inline-flex items-center', className)}>
        <div
          className={cn(
            'rounded-full transition-all duration-300',
            config.accentColor,
            sizeConfig.dot,
            config.animated && showAnimation && 'animate-status-pulse'
          )}
        />
        {config.animated && showAnimation && (
          <>
            <div
              className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-75',
                config.accentColor
              )}
            />
            <div
              className={cn(
                'absolute inset-0 rounded-full animate-status-glow opacity-50',
                config.accentColor
              )}
            />
          </>
        )}
      </div>
    );
  }

  // Icon variant - just the icon with color
  if (variant === 'icon') {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <Icon
          className={cn(
            sizeConfig.icon,
            config.color,
            (status === 'connecting' || status === 'initializing') && showAnimation && 'animate-spin'
          )}
          aria-label={config.text}
        />
      </div>
    );
  }

  // Accent bar variant - vertical bar indicator
  if (variant === 'accent-bar') {
    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            config.accentColor,
            sizeConfig.accent,
            config.animated && showAnimation && 'animate-status-pulse'
          )}
        />
        {config.animated && showAnimation && (
          <div
            className={cn(
              'absolute inset-0 rounded-full opacity-50',
              config.accentColor,
              'animate-status-glow'
            )}
          />
        )}
      </div>
    );
  }

  // Full variant - complete status indicator with background, icon, and text
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1.5 font-medium border transition-all duration-200',
        config.bgColor,
        config.borderColor,
        config.color,
        sizeConfig.container,
        className
      )}
    >
      {/* Animated pulse for connecting states */}
      {config.animated && showAnimation && (
        <div className="relative mr-1">
          <div
            className={cn(
              'rounded-full',
              config.pulseColor,
              sizeConfig.dot,
              'animate-status-pulse'
            )}
          />
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-75',
              config.pulseColor
            )}
          />
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-status-glow opacity-50',
              config.pulseColor
            )}
          />
        </div>
      )}

      <Icon
        className={cn(
          sizeConfig.icon,
          (status === 'connecting' || status === 'initializing') && showAnimation && 'animate-spin'
        )}
        aria-hidden="true"
      />
      
      {showText && (
        <span className="font-semibold whitespace-nowrap ml-1.5">{config.text}</span>
      )}
    </div>
  );
};

export default StatusIndicator;
export { STATUS_INDICATOR_CONFIGS };
export type { StatusIndicatorProps };