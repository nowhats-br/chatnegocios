import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Button from './Button';

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
          onClick={onClose}
          style={{ perspective: '1000px' }}
        >
          <motion.div
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              relative w-full max-w-md 
              bg-card border border-border/50 ${config.borderAccent}
              rounded-xl shadow-2xl overflow-hidden
              transform-gpu
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced header with icon and gradient accent */}
            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              
              <div className="p-6 space-y-4">
                {/* Icon and title */}
                <div className="flex items-start space-x-4">
                  <div className={`
                    flex-shrink-0 w-12 h-12 rounded-full ${config.iconBg} 
                    flex items-center justify-center
                    ring-1 ring-border/20
                  `}>
                    <DisplayIcon className={`h-6 w-6 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="typography-h4 font-semibold text-foreground">
                      {title}
                    </h2>
                    <p className="typography-body-sm text-muted-foreground mt-2 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced action buttons */}
            <div className="px-6 pb-6 pt-2">
              <div className="flex items-center justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  disabled={isConfirming}
                  className="min-w-[80px] hover:bg-muted/50"
                >
                  {cancelText}
                </Button>
                <Button 
                  variant={config.confirmVariant}
                  onClick={onConfirm} 
                  disabled={isConfirming}
                  loading={isConfirming}
                  icon={isConfirming ? Loader2 : undefined}
                  className="min-w-[100px]"
                >
                  {confirmText}
                </Button>
              </div>
            </div>

            {/* Subtle bottom accent */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlertDialog;
