import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FocusTrap } from './AccessibilityUtils';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'glass' | 'elevated';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  variant = 'default'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${React.useId()}`;
  const descriptionId = `modal-description-${React.useId()}`;

  // Enhanced accessibility and keyboard handling
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Set focus to modal when opened
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  // Size variants with improved responsive sizing
  const sizeClasses = {
    sm: 'max-w-sm w-full mx-4',
    md: 'max-w-lg w-full mx-4',
    lg: 'max-w-2xl w-full mx-4',
    xl: 'max-w-4xl w-full mx-4'
  };

  // Enhanced variant classes with modern styling
  const variantClasses = {
    default: 'bg-card/95 backdrop-blur-xl border border-border/20 shadow-2xl ring-1 ring-white/10',
    glass: 'bg-card/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl ring-1 ring-white/20',
    elevated: 'bg-card shadow-2xl border-0 ring-1 ring-black/5 dark:ring-white/10'
  };

  // Enhanced backdrop with improved blur and overlay effects
  const backdropVariants = {
    hidden: { 
      opacity: 0, 
      backdropFilter: 'blur(0px) saturate(100%)',
      background: 'rgba(0, 0, 0, 0)'
    },
    visible: { 
      opacity: 1, 
      backdropFilter: 'blur(12px) saturate(120%)',
      background: 'rgba(0, 0, 0, 0.75)',
      transition: { 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94] // Custom easing for smooth feel
      }
    },
    exit: { 
      opacity: 0, 
      backdropFilter: 'blur(0px) saturate(100%)',
      background: 'rgba(0, 0, 0, 0)',
      transition: { 
        duration: 0.3, 
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Enhanced modal content animations with spring physics
  const modalVariants = {
    hidden: { 
      scale: 0.8, 
      opacity: 0, 
      y: 60,
      rotateX: -20,
      filter: 'blur(4px)'
    },
    visible: { 
      scale: 1, 
      opacity: 1, 
      y: 0,
      rotateX: 0,
      filter: 'blur(0px)',
      transition: { 
        type: 'spring', 
        stiffness: 300, 
        damping: 24,
        mass: 0.9,
        delayChildren: 0.1,
        staggerChildren: 0.05
      }
    },
    exit: { 
      scale: 0.8, 
      opacity: 0, 
      y: 60,
      rotateX: -20,
      filter: 'blur(4px)',
      transition: { 
        duration: 0.25, 
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Header animation variants
  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    }
  };

  // Content animation variants
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, delay: 0.1, ease: 'easeOut' }
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
          style={{ 
            perspective: '1200px',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
            backdropFilter: 'blur(12px) saturate(120%)'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <FocusTrap active={isOpen} restoreFocus={true}>
            <motion.div
              ref={modalRef}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "relative modal-accessible text-contrast-aa",
                sizeClasses[size],
                variantClasses[variant],
                "rounded-2xl overflow-hidden",
                "transform-gpu will-change-transform",
                "max-h-[90vh] flex flex-col",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
              )}
              onClick={(e) => e.stopPropagation()}
              style={{ transformStyle: 'preserve-3d' }}
              tabIndex={-1}
            >
            {/* Enhanced decorative top border */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            
            {/* Enhanced header with improved styling */}
            <motion.div 
              variants={headerVariants}
              className="relative flex-shrink-0"
            >
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-border/30 bg-gradient-to-r from-card/80 via-card/90 to-card/80 backdrop-blur-sm">
                <h2 
                  id={titleId}
                  className="typography-h4 text-gradient-primary font-semibold tracking-tight"
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className={cn(
                    "group relative p-2.5 rounded-xl text-muted-foreground",
                    "hover:bg-accent/80 hover:text-accent-foreground",
                    "focus-ring-enhanced btn-accessible",
                    "transition-all duration-300 ease-out",
                    "hover:scale-110 active:scale-95",
                    "touch-target-mobile text-contrast-aa"
                  )}
                  aria-label="Fechar modal"
                  type="button"
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/0 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <X className="relative h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                </button>
              </div>
              
              {/* Subtle inner glow effect */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </motion.div>

            {/* Enhanced content area with improved scrolling */}
            <motion.div 
              variants={contentVariants}
              className="flex-1 overflow-y-auto overscroll-contain"
              id={descriptionId}
            >
              <div className="p-6 sm:p-8 bg-gradient-to-b from-card/95 via-card to-card/95 text-contrast-aa">
                {children}
              </div>
            </motion.div>

            {/* Enhanced bottom accent with subtle animation */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-60" />
            
            {/* Subtle corner highlights for depth */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-primary/5 to-transparent rounded-2xl pointer-events-none" />
            </motion.div>
          </FocusTrap>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
