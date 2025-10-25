import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadgeEnhanced, { StatusType } from './StatusBadgeEnhanced';

interface StatusNotificationProps {
  status: StatusType;
  title: string;
  message?: string;
  duration?: number;
  showProgress?: boolean;
  onClose?: () => void;
  className?: string;
}

const StatusNotification: React.FC<StatusNotificationProps> = ({
  status,
  title,
  message,
  duration = 5000,
  showProgress = true,
  onClose,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (duration / 100));
          if (newProgress <= 0) {
            setIsVisible(false);
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [duration]);

  useEffect(() => {
    if (!isVisible && onClose) {
      const timeout = setTimeout(onClose, 300); // Wait for exit animation
      return () => clearTimeout(timeout);
    }
  }, [isVisible, onClose]);

  const getNotificationIcon = () => {
    switch (status) {
      case 'connected':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'connecting':
      case 'initializing':
        return Info;
      case 'paused':
      case 'disconnected':
        return AlertTriangle;
      default:
        return Info;
    }
  };

  const getNotificationColors = () => {
    switch (status) {
      case 'connected':
        return {
          bg: 'bg-success/10 dark:bg-success/10',
          border: 'border-success/20 dark:border-success/30',
          text: 'text-success dark:text-success',
          progress: 'bg-success',
        };
      case 'error':
        return {
          bg: 'bg-error/10 dark:bg-error/10',
          border: 'border-error/20 dark:border-error/30',
          text: 'text-error dark:text-error',
          progress: 'bg-error',
        };
      case 'connecting':
      case 'initializing':
        return {
          bg: 'bg-info/10 dark:bg-info/10',
          border: 'border-info/20 dark:border-info/30',
          text: 'text-info dark:text-info',
          progress: 'bg-info',
        };
      case 'paused':
      case 'disconnected':
        return {
          bg: 'bg-warning/10 dark:bg-warning/10',
          border: 'border-warning/20 dark:border-warning/30',
          text: 'text-warning dark:text-warning',
          progress: 'bg-warning',
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-foreground',
          progress: 'bg-primary',
        };
    }
  };

  const NotificationIcon = getNotificationIcon();
  const colors = getNotificationColors();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn(
            'relative overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm',
            colors.bg,
            colors.border,
            className
          )}
        >
          {/* Progress bar */}
          {showProgress && duration > 0 && (
            <div className="absolute top-0 left-0 h-1 bg-border/20 w-full">
              <motion.div
                className={cn('h-full transition-all duration-100', colors.progress)}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Status icon */}
              <div className={cn('flex-shrink-0 mt-0.5', colors.text)}>
                <NotificationIcon className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                  <StatusBadgeEnhanced
                    status={status}
                    size="xs"
                    variant="minimal"
                    showText={false}
                  />
                </div>
                {message && (
                  <p className="text-sm text-muted-foreground">{message}</p>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => setIsVisible(false)}
                className="flex-shrink-0 p-1 rounded-md hover:bg-background/50 transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusNotification;