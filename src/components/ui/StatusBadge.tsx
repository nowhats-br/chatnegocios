import React from 'react';
import { CheckCircle, Loader2, Pause, AlertCircle, Wifi, WifiOff, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusType = 'connected' | 'connecting' | 'disconnected' | 'paused' | 'error' | 'initializing';

interface StatusConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
  text: string;
  pulseColor?: string;
  animated?: boolean;
}

const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  connected: {
    color: 'text-success dark:text-success',
    bgColor: 'bg-success/10 dark:bg-success/10',
    borderColor: 'border-success/20 dark:border-success/30',
    pulseColor: 'bg-success/30',
    icon: CheckCircle,
    text: 'Conectado',
  },
  connecting: {
    color: 'text-info dark:text-info',
    bgColor: 'bg-info/10 dark:bg-info/10',
    borderColor: 'border-info/20 dark:border-info/30',
    pulseColor: 'bg-info/30',
    icon: Loader2,
    text: 'Conectando...',
    animated: true,
  },
  initializing: {
    color: 'text-primary-500 dark:text-primary-400',
    bgColor: 'bg-primary-500/10 dark:bg-primary-400/10',
    borderColor: 'border-primary-500/20 dark:border-primary-400/30',
    pulseColor: 'bg-primary-500/30',
    icon: Wifi,
    text: 'Inicializando...',
    animated: true,
  },
  disconnected: {
    color: 'text-error dark:text-error',
    bgColor: 'bg-error/10 dark:bg-error/10',
    borderColor: 'border-error/20 dark:border-error/30',
    pulseColor: 'bg-error/30',
    icon: WifiOff,
    text: 'Desconectado',
  },
  paused: {
    color: 'text-warning dark:text-warning',
    bgColor: 'bg-warning/10 dark:bg-warning/10',
    borderColor: 'border-warning/20 dark:border-warning/30',
    pulseColor: 'bg-warning/30',
    icon: Pause,
    text: 'Pausado',
  },
  error: {
    color: 'text-error dark:text-error',
    bgColor: 'bg-error/10 dark:bg-error/10',
    borderColor: 'border-error/20 dark:border-error/30',
    pulseColor: 'bg-error/30',
    icon: AlertCircle,
    text: 'Erro',
  },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showPulse?: boolean;
  variant?: 'default' | 'minimal' | 'prominent';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showText = true,
  showPulse = false,
  variant = 'default',
  className,
}) => {
  const config = STATUS_CONFIGS[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      icon: 'h-3 w-3',
      gap: 'gap-1',
      pulse: 'h-2 w-2',
    },
    md: {
      container: 'px-2.5 py-1.5 text-sm',
      icon: 'h-4 w-4',
      gap: 'gap-1.5',
      pulse: 'h-2.5 w-2.5',
    },
    lg: {
      container: 'px-3 py-2 text-base',
      icon: 'h-5 w-5',
      gap: 'gap-2',
      pulse: 'h-3 w-3',
    },
  };

  const variantClasses = {
    default: 'border shadow-sm',
    minimal: 'border-0 shadow-none',
    prominent: 'border-2 shadow-md hover:shadow-lg transition-shadow duration-200',
  };

  const sizeConfig = sizeClasses[size];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-all duration-200 relative',
        config.bgColor,
        config.borderColor,
        config.color,
        sizeConfig.container,
        sizeConfig.gap,
        variantClasses[variant],
        className
      )}
    >
      {/* Pulse indicator for animated states */}
      {(showPulse || config.animated) && (
        <div className="relative mr-1">
          <div
            className={cn(
              'rounded-full',
              config.pulseColor,
              sizeConfig.pulse,
              config.animated && 'animate-status-pulse'
            )}
          />
          <div
            className={cn(
              'absolute inset-0 rounded-full opacity-75',
              config.pulseColor,
              config.animated && 'animate-ping'
            )}
          />
          {/* Additional glow effect for prominent variant */}
          {variant === 'prominent' && config.animated && (
            <div
              className={cn(
                'absolute inset-0 rounded-full opacity-50',
                config.pulseColor,
                'animate-status-glow'
              )}
            />
          )}
        </div>
      )}

      <Icon
        className={cn(
          sizeConfig.icon,
          (status === 'connecting' || status === 'initializing') && 'animate-spin',
          'transition-transform duration-200'
        )}
        aria-hidden="true"
      />
      
      {showText && (
        <span className="font-semibold whitespace-nowrap">{config.text}</span>
      )}
    </div>
  );
};

export default StatusBadge;
export { STATUS_CONFIGS };