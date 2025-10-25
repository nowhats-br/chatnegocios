import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
  // Handle escape key and body scroll lock
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 dark:bg-black/80 p-4"
          onClick={onClose}
          style={{ perspective: '1000px' }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              relative w-full ${sizeClasses[size]} 
              ${variantClasses[variant]}
              rounded-xl overflow-hidden
              transform-gpu
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced header with gradient border */}
            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex items-center justify-between p-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
                <h2 className="typography-h4 text-gradient-primary">{title}</h2>
                <button
                  onClick={onClose}
                  className="
                    p-2 rounded-lg text-muted-foreground 
                    hover:bg-accent hover:text-accent-foreground
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                    transition-all duration-200 ease-out
                    hover:scale-110 active:scale-95
                  "
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Enhanced content area */}
            <div className="p-6 bg-gradient-to-b from-card/50 to-card">
              {children}
            </div>

            {/* Subtle bottom accent */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
