import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import StatusBadgeEnhanced, { StatusType } from './StatusBadgeEnhanced';

interface StatusHistoryItem {
  id: string;
  status: StatusType;
  timestamp: Date;
  message?: string;
  duration?: number; // in milliseconds
}

interface StatusHistoryProps {
  items: StatusHistoryItem[];
  maxItems?: number;
  showDuration?: boolean;
  showMessages?: boolean;
  compact?: boolean;
  className?: string;
}

const StatusHistory: React.FC<StatusHistoryProps> = ({
  items,
  maxItems = 10,
  showDuration = true,
  showMessages = true,
  compact = false,
  className,
}) => {
  const displayItems = items.slice(0, maxItems);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  };

  if (displayItems.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p className="text-sm">Nenhum histórico de status disponível</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {displayItems.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors',
            compact && 'p-2'
          )}
        >
          {/* Timeline connector */}
          <div className="relative flex-shrink-0">
            <StatusBadgeEnhanced
              status={item.status}
              size={compact ? 'xs' : 'sm'}
              showText={false}
              variant="prominent"
            />
            {index < displayItems.length - 1 && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-px h-4 bg-border" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadgeEnhanced
                status={item.status}
                size={compact ? 'xs' : 'sm'}
                variant="minimal"
                showTimestamp={true}
                timestamp={item.timestamp}
              />
              {showDuration && item.duration && (
                <span className="text-xs text-muted-foreground">
                  ({formatDuration(item.duration)})
                </span>
              )}
            </div>
            
            {showMessages && item.message && (
              <p className={cn(
                'text-muted-foreground',
                compact ? 'text-xs' : 'text-sm'
              )}>
                {item.message}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex-shrink-0 text-right">
            <time className={cn(
              'text-muted-foreground font-mono',
              compact ? 'text-xs' : 'text-sm'
            )}>
              {formatTimestamp(item.timestamp)}
            </time>
          </div>
        </motion.div>
      ))}

      {items.length > maxItems && (
        <div className="text-center py-2">
          <span className="text-xs text-muted-foreground">
            +{items.length - maxItems} itens mais antigos
          </span>
        </div>
      )}
    </div>
  );
};

export default StatusHistory;
export type { StatusHistoryItem };