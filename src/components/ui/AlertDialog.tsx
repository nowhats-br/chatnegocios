import React, { useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Button from './Button';
import { FocusTrap } from './AccessibilityUtils';
import { cn } from '@/lib/utils';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  variant?: 'default' | 'destructive' | 'warning';
  icon?: React.ComponentType<{ className?: string }>;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isConfirming = false,
  variant = 'default',
  icon: Icon,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `alert-dialog-title-${React.useId()}`;
  const descriptionId = `alert-dialog-description-${React.useId()}`;

  // Enhanced keyboard handling and focus management
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isConfirming) {
          e.preventDefault();
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      // Focus the dialog when opened
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose, isConfirming]);
  // Enhanced backdrop blur and overlay
  const backdropVariants = {
    hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
    visible: { 
      opacity: 1, 
      backdropFilter: 'blur(6px)',
      transition: { duration: 0.25, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      backdropFilter: 'blur(0px)',
      transition: { duration: 0.2, ease: 'easeIn' }
    }
  };

  // Enhanced modal animations with subtle bounce
  const dialogVariants = {
    hidden: { 
      scale: 0.9, 
      opacity: 0, 
      y: 30,
      rotateX: -10
    },
    visible: { 
      scale: 1, 
      opacity: 1, 
      y: 0,
      rotateX: 0,
      transition: { 
        type: 'spring', 
        stiffness: 350, 
        damping: 25,
        mass: 0.9
      }
    },
    exit: { 
      scale: 0.85, 
      opacity: 0, 
      y: 30,
      rotateX: -10,
      transition: { 
        duration: 0.2, 
        ease: 'easeIn' 
      }
    }
  };

  // Variant configurations
  const variantConfig = {
    default: {
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      borderAccent: 'border-primary/20',
      confirmVariant: 'gradient' as const
    },
    destructive: {
      iconColor: 'text-destructive',
      iconBg: 'bg-destructive/10',
      borderAccent: 'border-destructive/20',
      confirmVariant: 'destructive' as const
    },
    warning: {
      iconColor: 'text-warning',
      iconBg: 'bg-warning/10',
      borderAccent: 'border-warning/20',
      confirmVariant: 'gradient' as const
    }
  };

  const config = variantConfig[variant];
  const DisplayIcon = Icon || (variant === 'destructive' ? AlertTriangle : AlertTriangle);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 dark:bg-black/80 p-4"
          onClick={!isConfirming ? onClose : undefined}
          style={{ perspective: '1000px' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <FocusTrap active={isOpen} restoreFocus={true}>
            <motion.div
              ref={dialogRef}
              variants={dialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "relative w-full max-w-md",
                "bg-card border border-border/50 text-contrast-aa",
                config.borderAccent,
                "rounded-xl shadow-2xl overflow-hidden",
                "transform-gpu modal-accessible",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
              )}
              onClick={(e) => e.stopPropagation()}
              tabIndex={-1}
            >
            {/* Enhanced header with icon and gradient accent */}
            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              
              <div className="p-6 space-y-5">
                {/* Enhanced icon and title layout */}
                <div className="flex items-start space-x-5">
                  <div className={`
                    relative flex-shrink-0 w-14 h-14 rounded-xl ${config.iconBg} 
                    flex items-center justify-center
                    ring-1 ring-border/20 shadow-lg
                  `}>
                    {/* Enhanced icon with animation for loading states */}
                    <DisplayIcon className={cn(
                      `h-7 w-7 ${config.iconColor}`,
                      isConfirming && variant === 'destructive' && 'animate-pulse'
                    )} />
                    
                    {/* Subtle glow effect for destructive actions */}
                    {variant === 'destructive' && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-destructive/20 to-transparent opacity-50" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-3">
                    <h2 
                      id={titleId}
                      className="typography-h3 font-bold text-foreground tracking-tight"
                    >
                      {title}
                    </h2>
                    <div className="space-y-2">
                      <p 
                        id={descriptionId}
                        className="typography-body text-muted-foreground leading-relaxed"
                      >
                        {description}
                      </p>
                      
                      {/* Enhanced warning for destructive actions */}
                      {variant === 'destructive' && (
                        <div className="flex items-start space-x-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <p className="typography-body-sm text-destructive font-medium">
                            Esta ação é irreversível e não pode ser desfeita.
                          </p>
                        </div>
                      )}
                      
                      {/* Loading state feedback */}
                      {isConfirming && (
                        <div className="flex items-center space-x-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                          <p className="typography-body-sm text-primary font-medium">
                            Processando solicitação...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced action buttons with improved layout */}
            <div className="px-6 pb-6 pt-4">
              <div className="flex items-center justify-between gap-4">
                {/* Action context indicator */}
                <div className="flex items-center space-x-2">
                  {isConfirming ? (
                    <>
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="typography-body-sm text-muted-foreground">
                        Aguarde...
                      </span>
                    </>
                  ) : (
                    <span className="typography-body-sm text-muted-foreground">
                      Escolha uma ação
                    </span>
                  )}
                </div>
                
                {/* Enhanced button group */}
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={onClose} 
                    disabled={isConfirming}
                    className={cn(
                      "min-w-[120px] transition-all duration-200",
                      "hover:bg-muted/50 hover:border-primary/40",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "focus-ring-enhanced btn-accessible"
                    )}
                    aria-label={`${cancelText} - Fechar diálogo sem confirmar`}
                  >
                    {cancelText}
                  </Button>
                  <Button 
                    variant={config.confirmVariant}
                    onClick={onConfirm} 
                    disabled={isConfirming}
                    loading={isConfirming}
                    icon={isConfirming ? Loader2 : undefined}
                    className={cn(
                      "min-w-[140px] font-semibold transition-all duration-200",
                      variant === 'destructive' && [
                        "btn-contrast-destructive focus-ring-destructive",
                        "shadow-lg hover:shadow-xl hover:shadow-destructive/25",
                        "hover:scale-[1.02] active:scale-[0.98]"
                      ],
                      variant === 'default' && [
                        "btn-contrast-primary focus-ring-enhanced",
                        "shadow-lg hover:shadow-xl hover:shadow-primary/25",
                        "hover:scale-[1.02] active:scale-[0.98]"
                      ],
                      isConfirming && "animate-pulse",
                      "btn-accessible"
                    )}
                    aria-label={`${confirmText} - Confirmar ação${variant === 'destructive' ? ' (irreversível)' : ''}`}
                    aria-describedby={variant === 'destructive' ? descriptionId : undefined}
                  >
                    {confirmText}
                  </Button>
                </div>
              </div>
            </div>

            {/* Subtle bottom accent */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            </motion.div>
          </FocusTrap>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlertDialog;
