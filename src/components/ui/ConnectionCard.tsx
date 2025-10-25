import React from 'react';
import { MoreVertical, QrCode, Trash2, Power, PowerOff, Pause, Loader2, Play } from 'lucide-react';
import { Card } from './Card';
import Button from './Button';
import StatusBadge, { StatusType } from './StatusBadge';
import StatusIndicator from './StatusIndicator';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './DropdownMenu';
import { useStatusAnnouncer, useStatusChangeAnnouncer, useKeyboardNavigation } from './AccessibilityUtils';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  name: string;
  status: string;
  instance_data?: {
    owner?: string;
    pushName?: string;
  };
  created_at: string;
  updated_at: string;
}

interface ConnectionCardProps {
  // New format with connection object
  connection?: Connection;
  // Legacy format with individual props
  instanceName?: string;
  phoneNumber?: string;
  status?: StatusType;
  // Common props
  isLoading?: boolean;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onShowQR?: () => void;
  onDelete?: () => void;
  className?: string;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  instanceName: propInstanceName,
  phoneNumber: propPhoneNumber,
  status: propStatus,
  isLoading = false,
  isConnecting = false,
  onConnect,
  onDisconnect,
  onPause,
  onResume,
  onShowQR,
  onDelete,
  className,
}) => {
  // Extract values from connection object or use individual props
  const instanceName = connection?.name || propInstanceName || '';
  const phoneNumber = connection?.instance_data?.owner || propPhoneNumber || '';
  const status = (connection?.status as StatusType) || propStatus || 'disconnected';
  const { LiveRegionComponent } = useStatusAnnouncer();
  const { announceConnectionChange, announceLoadingState, announceAction } = useStatusChangeAnnouncer();
  const cardId = `connection-card-${(instanceName || 'unknown').replace(/[^a-zA-Z0-9]/g, '-')}`;
  const statusId = `${cardId}-status`;
  const actionsId = `${cardId}-actions`;
  const previousStatus = React.useRef<StatusType>(status);

  // Enhanced status change announcements with better context
  React.useEffect(() => {
    if (previousStatus.current !== status) {
      announceConnectionChange(instanceName, status, previousStatus.current);
      previousStatus.current = status;
    }
  }, [status, instanceName, announceConnectionChange]);

  // Announce loading states for better user feedback
  React.useEffect(() => {
    if (isLoading) {
      const action = status === 'connecting' ? 'connect' : 
                   status === 'disconnected' ? 'disconnect' : 'update';
      announceLoadingState(action, `instância ${instanceName}`, true);
    }
  }, [isLoading, status, instanceName, announceLoadingState]);

  // Enhanced keyboard navigation for the card
  const { handleKeyDown } = useKeyboardNavigation(
    () => {
      // Enter key - trigger primary action
      const primaryButton = document.querySelector(`#${cardId} [data-primary-action="true"]`) as HTMLButtonElement;
      if (primaryButton && !primaryButton.disabled) {
        primaryButton.click();
      }
    },
    undefined, // Escape - handled by parent
    undefined, // Arrow keys handled by grid navigation
    undefined,
    undefined,
    undefined,
    {
      preventDefault: false, // Let grid navigation handle arrows
      stopPropagation: false
    }
  );
  const renderPrimaryAction = () => {
    const baseButtonClasses = cn(
      // Comprehensive mobile touch targets with WCAG AA compliance
      "touch-target-primary",
      // Enhanced responsive width optimization for different screen sizes
      "w-full xs:w-auto xs:min-w-[100px] sm:min-w-[110px] md:min-w-[120px] lg:min-w-[110px]",
      // Optimized responsive text sizing with better readability
      "text-sm sm:text-base lg:text-sm xl:text-base font-medium",
      // Enhanced touch feedback with comprehensive motion support
      "active:scale-95 transition-all duration-200 ease-out",
      "motion-reduce:active:scale-100 motion-reduce:transition-none",
      // Comprehensive accessibility enhancements
      "focus-ring-enhanced keyboard-navigable",
      // Better interaction area optimization for mobile
      "interaction-area-mobile sm:interaction-area-desktop"
    );

    if (status === 'disconnected') {
      return (
        <Button
          variant="gradient-success"
          size="sm"
          onClick={() => {
            onConnect?.();
            announceAction('connect', `instância ${instanceName}`, 'pending');
          }}
          disabled={isLoading}
          loading={isLoading}
          icon={Power}
          aria-label={`Conectar instância ${instanceName}`}
          aria-describedby={statusId}
          data-primary-action="true"
          className={cn(baseButtonClasses, "btn-contrast-success focus-ring-success")}
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
          onClick={() => {
            onDisconnect?.();
            announceAction('disconnect', `instância ${instanceName}`, 'pending');
          }}
          disabled={isLoading}
          loading={isLoading}
          icon={PowerOff}
          aria-label={`Desconectar instância ${instanceName}`}
          aria-describedby={statusId}
          data-primary-action="true"
          className={cn(baseButtonClasses, "btn-contrast-destructive focus-ring-destructive")}
        >
          Desconectar
        </Button>
      );
    }

    if (status === 'connecting' || status === 'initializing' || isConnecting) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          icon={Loader2}
          aria-label={`Instância ${instanceName} está ${status === 'connecting' || isConnecting ? 'conectando' : 'inicializando'}`}
          aria-describedby={statusId}
          className={cn(baseButtonClasses, "cursor-not-allowed")}
        >
          <span className="hidden sm:inline">
            {status === 'connecting' || isConnecting ? 'Conectando...' : 'Inicializando...'}
          </span>
          <span className="sm:hidden">
            {status === 'connecting' || isConnecting ? 'Conectando' : 'Iniciando'}
          </span>
        </Button>
      );
    }

    if (status === 'paused') {
      return (
        <Button
          variant="gradient"
          size="sm"
          onClick={() => {
            onResume?.();
            announceAction('resume', `instância ${instanceName}`, 'pending');
          }}
          disabled={isLoading}
          loading={isLoading}
          icon={Play}
          aria-label={`Retomar instância ${instanceName}`}
          aria-describedby={statusId}
          data-primary-action="true"
          className={cn(baseButtonClasses, "btn-contrast-primary focus-ring-enhanced")}
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
          onClick={() => {
            onPause?.();
            announceAction('pause', `instância ${instanceName}`, 'pending');
          }}
          disabled={isLoading}
          icon={Pause}
          aria-label={`Pausar instância ${instanceName}`}
          aria-describedby={statusId}
          className={cn(
            // Comprehensive mobile touch targets with WCAG AA compliance
            "touch-target-secondary",
            // Enhanced responsive width optimization
            "w-full xs:w-auto xs:min-w-[90px] sm:min-w-[100px] md:min-w-[110px] lg:min-w-[100px]",
            // Optimized responsive text sizing
            "text-sm sm:text-base lg:text-sm xl:text-base font-medium",
            // Enhanced touch feedback with comprehensive motion support
            "active:scale-95 transition-all duration-200 ease-out",
            "motion-reduce:active:scale-100 motion-reduce:transition-none",
            // Comprehensive accessibility enhancements
            "focus-ring-enhanced keyboard-navigable",
            // Better interaction area optimization
            "interaction-area-mobile sm:interaction-area-desktop"
          )}
        >
          <span className="hidden sm:inline lg:hidden xl:inline">Pausar</span>
          <span className="sm:hidden lg:inline xl:hidden">Pause</span>
        </Button>
      );
    }
    return null;
  };

  return (
    <>
      <Card
        variant="elevated"
        interactive
        role="article"
        aria-labelledby={`${cardId}-title`}
        aria-describedby={statusId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative overflow-hidden group',
          // Enhanced responsive behavior with comprehensive optimization
          'card-responsive',
          // Comprehensive hover states with better visual hierarchy
          'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
          'lg:hover:shadow-2xl lg:hover:scale-[1.03]',
          // Optimized touch-friendly active states with better feedback
          'active:scale-[0.98] active:translate-y-0 active:shadow-lg',
          'active:transition-transform active:duration-150',
          // Enhanced mobile-optimized touch interactions
          'touch-manipulation select-none cursor-pointer',
          // Comprehensive responsive sizing and spacing optimization
          'h-full w-full flex flex-col',
          // Enhanced accessibility for comprehensive keyboard navigation
          'card-accessible keyboard-navigable focus-ring-card',
          'focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2',
          'focus-within:ring-offset-background focus-within:z-10',
          // Enhanced focus management for keyboard users
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4',
          'focus-visible:ring-offset-background focus-visible:outline-none',
          // Comprehensive reduced motion support for accessibility
          'motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0',
          'motion-reduce:active:scale-100 motion-reduce:transition-none',
          'motion-reduce:will-change-auto',
          // Performance optimizations for smooth interactions
          'transform-gpu will-change-transform backface-visibility-hidden',
          'transition-all duration-300 ease-out',
          // Enhanced contrast support
          'text-contrast-aa',
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
        // Comprehensive responsive padding with optimal content density
        "content-density-cozy",
        // Enhanced spacing with comprehensive responsive optimization
        "spacing-content-md",
        // Better content organization and hierarchy
        "justify-between"
      )}>
        {/* Enhanced card header with comprehensive responsive optimization */}
        <div className={cn(
          "flex items-start justify-between",
          // Enhanced responsive spacing and alignment
          "gap-3 sm:gap-4 lg:gap-3 xl:gap-4"
        )}>
          <div className={cn(
            "flex-1 min-w-0",
            // Optimized responsive spacing for content hierarchy
            "spacing-content-sm"
          )}>
            {/* Enhanced instance name with comprehensive responsive typography */}
            <h3 
              id={`${cardId}-title`}
              className={cn(
                "font-semibold truncate transition-colors duration-200 group-hover:text-primary",
                // Comprehensive responsive typography with optimal scaling
                "text-responsive-subtitle",
                // Enhanced line height optimization for different screen sizes
                "leading-tight sm:leading-snug lg:leading-tight",
                // Comprehensive focus styles for keyboard navigation
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "focus-visible:ring-offset-1 focus-visible:rounded-sm keyboard-navigable"
              )}
              tabIndex={-1} // Allow programmatic focus for skip links
            >
              {instanceName}
            </h3>
            
            {/* Enhanced phone number with comprehensive responsive styling */}
            <p 
              className={cn(
                "text-muted-foreground transition-colors duration-200",
                // Optimized responsive text sizing with better readability
                "text-responsive-caption",
                // Enhanced line height for mobile readability
                "leading-relaxed sm:leading-normal",
                // Better truncation handling for long numbers
                "truncate"
              )}
              aria-label={phoneNumber ? `Número: ${phoneNumber}` : 'Número não disponível'}
              title={phoneNumber || 'Número não disponível'} // Tooltip for truncated content
            >
              {phoneNumber || 'Número não disponível'}
            </p>
          </div>

          {/* Enhanced actions menu with comprehensive responsive behavior and accessibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "shrink-0 transition-all duration-200",
                  // Comprehensive responsive spacing and sizing optimization
                  "ml-2 sm:ml-3 lg:ml-2 xl:ml-3",
                  // Enhanced touch targets with WCAG AA compliance
                  "touch-target-icon",
                  "h-9 w-9 sm:h-10 sm:w-10 lg:h-9 lg:w-9 xl:h-10 xl:w-10",
                  // Enhanced visibility and comprehensive interaction states
                  "opacity-70 group-hover:opacity-100 lg:group-hover:opacity-90 xl:group-hover:opacity-100",
                  "hover:bg-accent/80 hover:scale-110 lg:hover:scale-105 xl:hover:scale-110",
                  "active:scale-95 active:bg-accent active:transition-transform active:duration-150",
                  // Comprehensive accessibility enhancements
                  "focus-ring-enhanced keyboard-navigable",
                  // Better interaction area optimization
                  "interaction-area-mobile sm:interaction-area-desktop",
                  // Reduced motion support
                  "motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                )}
                aria-label={`Opções para instância ${instanceName}`}
                aria-haspopup="menu"
                aria-expanded={false}
              >
                <MoreVertical className={cn(
                  "transition-transform duration-200",
                  // Responsive icon sizing
                  "h-4 w-4 sm:h-5 sm:w-5 lg:h-4 lg:w-4 xl:h-5 xl:w-5"
                )} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48"
              role="menu"
              aria-label={`Menu de opções para ${instanceName}`}
            >
              <DropdownMenuItem 
                onSelect={onShowQR}
                role="menuitem"
                className="cursor-pointer hover:bg-accent/80 transition-colors duration-150 focus-ring-enhanced"
              >
                <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                Ver QR Code
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  "cursor-pointer transition-colors duration-150",
                  "text-destructive hover:text-destructive hover:bg-destructive/10",
                  "focus:text-destructive focus:bg-destructive/10",
                  "focus-ring-destructive"
                )}
                onSelect={onDelete}
                role="menuitem"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Excluir Instância
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status section with enhanced responsive feedback and accessibility */}
        <div className="flex-1 flex flex-col justify-center">
          <div id={statusId} role="status" aria-live="polite">
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
        </div>

        {/* Enhanced action buttons with comprehensive responsive layout and accessibility */}
        <div 
          id={actionsId}
          className={cn(
            "flex items-center",
            // Comprehensive responsive gap optimization
            "gap-2 xs:gap-3 sm:gap-4 lg:gap-3 xl:gap-4",
            // Enhanced responsive layout with better mobile stacking
            "flex-col xs:flex-row",
            // Optimized spacing and alignment with better content hierarchy
            "mt-auto pt-3 sm:pt-4 lg:pt-3 xl:pt-4",
            // Better visual separation
            "border-t border-border/20 dark:border-border/10"
          )}
          role="group"
          aria-label={`Ações para instância ${instanceName}`}
        >
          {/* Enhanced secondary actions with better responsive behavior */}
          <div className={cn(
            "flex items-center w-full xs:w-auto",
            // Responsive gap for secondary actions
            "gap-2 xs:gap-3 sm:gap-2"
          )}>
            {renderSecondaryAction()}
          </div>

          {/* Enhanced primary action with comprehensive mobile optimization */}
          <div className={cn(
            "flex items-center w-full xs:w-auto",
            // Better responsive alignment
            "xs:ml-auto xs:justify-end"
          )}>
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
    
    {/* Live region for status announcements */}
    <LiveRegionComponent />
    </>
  );
};

export default ConnectionCard;