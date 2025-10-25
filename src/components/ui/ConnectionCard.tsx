import React from 'react';
import { MoreVertical, QrCode, Trash2, Power, PowerOff, Pause, Loader2, Play } from 'lucide-react';
import { Card } from './Card';
import Button from './Button';
import StatusBadge, { StatusType } from './StatusBadge';
import StatusIndicator from './StatusIndicator';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './DropdownMenu';
import { cn } from '@/lib/utils';

interface ConnectionCardProps {
  instanceName: string;
  phoneNumber: string;
  status: StatusType;
  isLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onShowQR?: () => void;
  onDelete?: () => void;
  className?: string;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  instanceName,
  phoneNumber,
  status,
  isLoading = false,
  onConnect,
  onDisconnect,
  onPause,
  onResume,
  onShowQR,
  onDelete,
  className,
}) => {
  const renderPrimaryAction = () => {
    const baseButtonClasses = cn(
      // Enhanced mobile touch targets
      "min-h-[44px] w-full xs:w-auto xs:min-w-[100px] sm:min-w-[110px]",
      // Better responsive text sizing
      "text-sm sm:text-base font-medium",
      // Enhanced touch feedback
      "active:scale-95 transition-all duration-200",
      // Improved focus accessibility
      "focus-visible:ring-2 focus-visible:ring-offset-2"
    );

    if (status === 'disconnected') {
      return (
        <Button
          variant="gradient-success"
          size="sm"
          onClick={onConnect}
          disabled={isLoading}
          loading={isLoading}
          icon={Power}
          aria-label={`Conectar instância ${instanceName}`}
          className={baseButtonClasses}
        >
          Conectar
        </Button>
      );
    }

    if (status === 'connected') {
      return (
        <Button
          variant="gradient-destructive"
          size="sm"
          onClick={onDisconnect}
          disabled={isLoading}
          loading={isLoading}
          icon={PowerOff}
          aria-label={`Desconectar instância ${instanceName}`}
          className={baseButtonClasses}
        >
          Desconectar
        </Button>
      );
    }

    if (status === 'connecting' || status === 'initializing') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          icon={Loader2}
          aria-label={`Instância ${instanceName} conectando`}
          className={cn(baseButtonClasses, "cursor-not-allowed")}
        >
          <span className="hidden sm:inline">Conectando...</span>
          <span className="sm:hidden">Conectando</span>
        </Button>
      );
    }

    if (status === 'paused') {
      return (
        <Button
          variant="gradient"
          size="sm"
          onClick={onResume}
          disabled={isLoading}
          loading={isLoading}
          icon={Play}
          aria-label={`Retomar instância ${instanceName}`}
          className={baseButtonClasses}
        >
          Retomar
        </Button>
      );
    }

    return null;
  };

  const renderSecondaryAction = () => {
    if (status === 'connected') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={onPause}
          disabled={isLoading}
          icon={Pause}
          aria-label={`Pausar instância ${instanceName}`}
          className={cn(
            // Enhanced mobile touch targets
            "min-h-[44px] w-full xs:w-auto xs:min-w-[90px]",
            // Better responsive text sizing
            "text-sm sm:text-base font-medium",
            // Enhanced touch feedback
            "active:scale-95 transition-all duration-200",
            // Improved focus accessibility
            "focus-visible:ring-2 focus-visible:ring-offset-2"
          )}
        >
          Pausar
        </Button>
      );
    }
    return null;
  };

  return (
    <Card
      variant="elevated"
      interactive
      className={cn(
        'relative overflow-hidden group transition-all duration-300',
        // Enhanced responsive hover states
        'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
        // Touch-friendly active states with better feedback
        'active:scale-[0.98] active:translate-y-0 active:shadow-lg',
        // Mobile-optimized touch interactions
        'touch-manipulation select-none',
        // Improved responsive sizing and spacing
        'h-full w-full flex flex-col',
        // Enhanced accessibility for keyboard navigation
        'focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2',
        'focus-within:ring-offset-background',
        // Reduced motion support
        'motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0',
        'motion-reduce:active:scale-100 motion-reduce:transition-none',
        className
      )}
    >
      {/* Status accent border with enhanced animation */}
      <StatusIndicator
        status={status}
        variant="accent-bar"
        size="lg"
        showAnimation={true}
        className="absolute left-0 top-0 h-full transition-all duration-300 group-hover:w-2"
      />

      <div className={cn(
        "relative flex flex-col h-full",
        // Responsive padding with mobile optimization
        "p-4 sm:p-5 lg:p-6",
        // Enhanced spacing for better content hierarchy
        "space-y-4 sm:space-y-5"
      )}>
        {/* Card Header - Instance info with proper hierarchy */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
            {/* Primary: Instance name with responsive typography */}
            <h3 className={cn(
              "font-semibold truncate transition-colors duration-200 group-hover:text-primary",
              // Responsive typography scaling
              "text-lg sm:text-xl lg:text-lg xl:text-xl",
              // Enhanced line height for readability
              "leading-tight"
            )}>
              {instanceName}
            </h3>
            {/* Secondary: Phone number with responsive styling */}
            <p className={cn(
              "text-muted-foreground transition-colors duration-200",
              // Responsive text sizing
              "text-sm sm:text-base lg:text-sm",
              // Better line height for mobile
              "leading-relaxed"
            )}>
              {phoneNumber || 'Número não disponível'}
            </p>
          </div>

          {/* Actions menu with enhanced responsive behavior */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "shrink-0 transition-all duration-200",
                  // Responsive spacing and sizing
                  "ml-2 sm:ml-3",
                  "h-8 w-8 sm:h-9 sm:w-9",
                  // Enhanced mobile touch targets
                  "min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]",
                  // Improved visibility and interaction states
                  "opacity-70 group-hover:opacity-100",
                  "hover:bg-accent/80 hover:scale-110",
                  "active:scale-95 active:bg-accent",
                  // Better focus accessibility
                  "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
                )}
                aria-label={`Opções para ${instanceName}`}
              >
                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onSelect={onShowQR}
                className="cursor-pointer hover:bg-accent/80 transition-colors duration-150"
              >
                <QrCode className="mr-2 h-4 w-4" />
                Ver QR Code
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  "cursor-pointer transition-colors duration-150",
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                  "focus:text-destructive focus:bg-destructive/10"
                )}
                onSelect={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Instância
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status section with enhanced responsive feedback */}
        <div className="flex-1 flex flex-col justify-center">
          <StatusBadge 
            status={status} 
            size="md" 
            variant="prominent"
            showPulse={status === 'connecting' || status === 'initializing'}
            className={cn(
              "transition-all duration-200 group-hover:scale-105",
              // Responsive sizing for better mobile visibility
              "text-sm sm:text-base"
            )}
          />
        </div>

        {/* Action buttons with responsive layout and clear hierarchy */}
        <div className={cn(
          "flex items-center gap-2 sm:gap-3",
          // Responsive layout: stack on very small screens, side-by-side on larger
          "flex-col xs:flex-row",
          // Better spacing and alignment
          "mt-auto pt-2"
        )}>
          {/* Secondary actions */}
          <div className="flex items-center gap-2 w-full xs:w-auto">
            {renderSecondaryAction()}
          </div>

          {/* Primary action with enhanced mobile optimization */}
          <div className="flex items-center w-full xs:w-auto xs:ml-auto">
            {renderPrimaryAction()}
          </div>
        </div>

        {/* Subtle gradient overlay for depth */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
        )} />
      </div>
    </Card>
  );
};

export default ConnectionCard;