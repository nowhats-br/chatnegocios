import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Live region component for dynamic status announcements
interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearAfter?: number; // Clear message after X milliseconds
  className?: string;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  priority = 'polite',
  clearAfter = 5000,
  className,
}) => {
  const [currentMessage, setCurrentMessage] = React.useState(message);

  useEffect(() => {
    setCurrentMessage(message);
    
    if (clearAfter && message) {
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
      
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className={cn('sr-only', className)}
      role="status"
    >
      {currentMessage}
    </div>
  );
};

// Skip link component for keyboard navigation
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  href,
  children,
  className,
}) => {
  return (
    <a
      href={href}
      className={cn('skip-link', className)}
      onFocus={() => {
        // Ensure the target element exists and is focusable
        const target = document.querySelector(href);
        if (target && !target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
      }}
    >
      {children}
    </a>
  );
};

// Focus trap component for modals and dropdowns
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
  className?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  restoreFocus = true,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      return container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus the first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore focus to the previously active element
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, restoreFocus]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

// Accessible heading component with proper hierarchy
interface AccessibleHeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const AccessibleHeading: React.FC<AccessibleHeadingProps> = ({
  level,
  children,
  className,
  id,
}) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag
      id={id}
      className={cn(
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-sm',
        className
      )}
      tabIndex={-1} // Allow programmatic focus for skip links
    >
      {children}
    </Tag>
  );
};

// Accessible button with enhanced ARIA support
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  loading = false,
  loadingText = 'Carregando...',
  children,
  disabled,
  'aria-label': ariaLabel,
  className,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      aria-label={loading ? `${ariaLabel || children} - ${loadingText}` : ariaLabel}
      className={cn(
        'btn-accessible focus-ring-enhanced',
        'transition-all duration-200 ease-in-out',
        isDisabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {loading && (
        <span className="sr-only" role="status" aria-live="polite">
          {loadingText}
        </span>
      )}
      {children}
    </button>
  );
};

// Enhanced status announcer hook with comprehensive screen reader support
export const useStatusAnnouncer = () => {
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState<'polite' | 'assertive'>('polite');
  const [messageHistory, setMessageHistory] = React.useState<Array<{
    id: string;
    message: string;
    timestamp: number;
    priority: 'polite' | 'assertive';
  }>>([]);

  const announce = React.useCallback((
    newMessage: string, 
    newPriority: 'polite' | 'assertive' = 'polite',
    options?: {
      skipIfRecent?: boolean; // Skip if same message was announced recently
      recentThreshold?: number; // Time in ms to consider "recent"
      persistent?: boolean; // Keep message visible longer
    }
  ) => {
    const { 
      skipIfRecent = true, 
      recentThreshold = 3000, 
      persistent = false 
    } = options || {};

    // Check if we should skip this announcement
    if (skipIfRecent) {
      const now = Date.now();
      const recentMessage = messageHistory.find(
        msg => msg.message === newMessage && (now - msg.timestamp) < recentThreshold
      );
      if (recentMessage) {
        return; // Skip duplicate recent announcement
      }
    }

    // Add to message history
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessageHistory(prev => [
      ...prev.slice(-9), // Keep last 10 messages
      {
        id: messageId,
        message: newMessage,
        timestamp: Date.now(),
        priority: newPriority
      }
    ]);

    // Clear and set new message for screen readers
    setMessage(''); // Clear first to ensure re-announcement
    setTimeout(() => {
      setMessage(newMessage);
      setPriority(newPriority);
    }, 100);

    // Auto-clear message unless persistent
    if (!persistent) {
      setTimeout(() => {
        setMessage('');
      }, newPriority === 'assertive' ? 8000 : 5000);
    }
  }, [messageHistory]);

  const clear = React.useCallback(() => {
    setMessage('');
  }, []);

  const announceStatusChange = React.useCallback((
    instanceName: string,
    _oldStatus: string,
    newStatus: string,
    additionalInfo?: string
  ) => {
    const statusMessages = {
      connected: 'conectada com sucesso',
      connecting: 'iniciando conexão',
      disconnected: 'desconectada',
      paused: 'pausada',
      initializing: 'inicializando',
      error: 'com erro de conexão'
    };

    const statusMessage = statusMessages[newStatus as keyof typeof statusMessages] || newStatus;
    const fullMessage = `Instância ${instanceName} ${statusMessage}${additionalInfo ? `. ${additionalInfo}` : ''}`;
    
    announce(fullMessage, 'polite', { skipIfRecent: true });
  }, [announce]);

  const announceAction = React.useCallback((
    action: string,
    target: string,
    result?: 'success' | 'error' | 'pending'
  ) => {
    const actionMessages = {
      connect: 'Conectando',
      disconnect: 'Desconectando', 
      pause: 'Pausando',
      resume: 'Retomando',
      delete: 'Excluindo',
      create: 'Criando'
    };

    const resultMessages = {
      success: 'concluído com sucesso',
      error: 'falhou',
      pending: 'em andamento'
    };

    const actionText = actionMessages[action as keyof typeof actionMessages] || action;
    const resultText = result ? ` - ${resultMessages[result]}` : '';
    const message = `${actionText} ${target}${resultText}`;
    
    announce(message, result === 'error' ? 'assertive' : 'polite');
  }, [announce]);

  return {
    announce,
    announceStatusChange,
    announceAction,
    clear,
    messageHistory,
    LiveRegionComponent: () => (
      <LiveRegion 
        message={message} 
        priority={priority} 
        clearAfter={priority === 'assertive' ? 8000 : 5000}
      />
    ),
  };
};

// Accessible form field with proper labeling and error handling
interface AccessibleFormFieldProps {
  id: string;
  label: string;
  error?: string;
  success?: string;
  warning?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  id,
  label,
  error,
  success,
  warning,
  required = false,
  children,
  className,
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const successId = success ? `${id}-success` : undefined;
  const warningId = warning ? `${id}-warning` : undefined;
  
  const describedBy = [errorId, successId, warningId].filter(Boolean).join(' ');

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-medium text-foreground',
          required && "after:content-['*'] after:ml-0.5 after:text-destructive"
        )}
      >
        {label}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? 'true' : 'false',
        'aria-required': required,
      })}
      
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-sm text-error"
        >
          {error}
        </div>
      )}
      
      {success && (
        <div
          id={successId}
          role="status"
          aria-live="polite"
          className="text-sm text-success"
        >
          {success}
        </div>
      )}
      
      {warning && (
        <div
          id={warningId}
          role="alert"
          aria-live="polite"
          className="text-sm text-warning"
        >
          {warning}
        </div>
      )}
    </div>
  );
};

// Enhanced keyboard navigation helper with comprehensive support
export const useKeyboardNavigation = (
  onEnter?: () => void,
  onEscape?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void,
  options?: {
    preventDefault?: boolean;
    stopPropagation?: boolean;
    enableHomeEnd?: boolean;
    onHome?: () => void;
    onEnd?: () => void;
  }
) => {
  const {
    preventDefault = true,
    stopPropagation = false,
    enableHomeEnd = false,
    onHome,
    onEnd
  } = options || {};

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    let handled = false;

    switch (e.key) {
      case 'Enter':
      case ' ': // Space key
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onEnter?.();
        handled = true;
        break;
      case 'Escape':
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onEscape?.();
        handled = true;
        break;
      case 'ArrowUp':
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onArrowUp?.();
        handled = true;
        break;
      case 'ArrowDown':
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onArrowDown?.();
        handled = true;
        break;
      case 'ArrowLeft':
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onArrowLeft?.();
        handled = true;
        break;
      case 'ArrowRight':
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        onArrowRight?.();
        handled = true;
        break;
      case 'Home':
        if (enableHomeEnd && onHome) {
          if (preventDefault) e.preventDefault();
          if (stopPropagation) e.stopPropagation();
          onHome();
          handled = true;
        }
        break;
      case 'End':
        if (enableHomeEnd && onEnd) {
          if (preventDefault) e.preventDefault();
          if (stopPropagation) e.stopPropagation();
          onEnd();
          handled = true;
        }
        break;
    }

    return handled;
  }, [onEnter, onEscape, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onHome, onEnd, preventDefault, stopPropagation, enableHomeEnd]);

  return { handleKeyDown };
};

// Enhanced grid navigation hook for complex layouts
export const useGridNavigation = (
  gridRef: React.RefObject<HTMLElement>,
  options?: {
    columns?: number;
    rows?: number;
    wrap?: boolean;
    onActivate?: (index: number) => void;
  }
) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const { columns = 3, rows, wrap = true, onActivate } = options || {};

  const focusItem = React.useCallback((index: number) => {
    if (!gridRef.current) return;
    
    const items = gridRef.current.querySelectorAll('[role="gridcell"]');
    const item = items[index] as HTMLElement;
    
    if (item) {
      // Remove tabindex from all items
      items.forEach(el => el.setAttribute('tabindex', '-1'));
      // Set tabindex and focus on current item
      item.setAttribute('tabindex', '0');
      item.focus();
      setCurrentIndex(index);
    }
  }, [gridRef]);

  const { handleKeyDown } = useKeyboardNavigation(
    () => onActivate?.(currentIndex), // Enter
    undefined, // Escape
    () => { // Arrow Up
      const newIndex = currentIndex - columns;
      if (newIndex >= 0) {
        focusItem(newIndex);
      } else if (wrap && rows) {
        focusItem(currentIndex + (rows - 1) * columns);
      }
    },
    () => { // Arrow Down
      if (!gridRef.current) return;
      const totalItems = gridRef.current.querySelectorAll('[role="gridcell"]').length;
      const newIndex = currentIndex + columns;
      if (newIndex < totalItems) {
        focusItem(newIndex);
      } else if (wrap) {
        focusItem(currentIndex % columns);
      }
    },
    () => { // Arrow Left
      if (currentIndex > 0) {
        focusItem(currentIndex - 1);
      } else if (wrap && gridRef.current) {
        const totalItems = gridRef.current.querySelectorAll('[role="gridcell"]').length;
        focusItem(totalItems - 1);
      }
    },
    () => { // Arrow Right
      if (!gridRef.current) return;
      const totalItems = gridRef.current.querySelectorAll('[role="gridcell"]').length;
      if (currentIndex < totalItems - 1) {
        focusItem(currentIndex + 1);
      } else if (wrap) {
        focusItem(0);
      }
    },
    {
      enableHomeEnd: true,
      onHome: () => focusItem(0),
      onEnd: () => {
        if (!gridRef.current) return;
        const totalItems = gridRef.current.querySelectorAll('[role="gridcell"]').length;
        focusItem(totalItems - 1);
      }
    }
  );

  return {
    currentIndex,
    focusItem,
    handleKeyDown
  };
};

// Enhanced status change announcer for dynamic content
export const useStatusChangeAnnouncer = () => {
  const { announceStatusChange, announceAction } = useStatusAnnouncer();
  
  const announceConnectionChange = React.useCallback((
    instanceName: string,
    newStatus: string,
    previousStatus?: string
  ) => {
    if (previousStatus && previousStatus !== newStatus) {
      announceStatusChange(instanceName, previousStatus, newStatus);
    }
  }, [announceStatusChange]);

  const announceLoadingState = React.useCallback((
    action: string,
    target: string,
    isLoading: boolean
  ) => {
    if (isLoading) {
      announceAction(action, target, 'pending');
    }
  }, [announceAction]);

  return {
    announceConnectionChange,
    announceLoadingState,
    announceAction
  };
};

// Color contrast checker utility (placeholder implementation)
export const checkColorContrast = (): { ratio: number; wcagAA: boolean; wcagAAA: boolean } => {
  // Simple contrast ratio calculation (would need full implementation in production)
  // This is a placeholder for the actual contrast calculation
  const ratio = 4.5; // Placeholder - would calculate actual ratio
  
  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7.0
  };
};

// Enhanced accessibility context provider
interface AccessibilityContextType {
  announceStatusChange: (instanceName: string, oldStatus: string, newStatus: string, additionalInfo?: string) => void;
  announceAction: (action: string, target: string, result?: 'success' | 'error' | 'pending') => void;
  isHighContrast: boolean;
  isReducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
}

const AccessibilityContext = React.createContext<AccessibilityContextType | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { announceStatusChange, announceAction } = useStatusAnnouncer();
  const [fontSize, setFontSize] = React.useState<'small' | 'medium' | 'large'>('medium');
  
  // Detect user preferences
  const [isHighContrast, setIsHighContrast] = React.useState(false);
  const [isReducedMotion, setIsReducedMotion] = React.useState(false);

  React.useEffect(() => {
    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(highContrastQuery.matches);
    
    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };
    
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(reducedMotionQuery.matches);
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    return () => {
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  const value: AccessibilityContextType = {
    announceStatusChange,
    announceAction,
    isHighContrast,
    isReducedMotion,
    fontSize,
    setFontSize
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = React.useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};