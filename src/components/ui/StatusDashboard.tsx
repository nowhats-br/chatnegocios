import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Activity, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import StatusBadgeEnhanced, { StatusType } from './StatusBadgeEnhanced';
import StatusHistory, { StatusHistoryItem } from './StatusHistory';
import StatusNotification from './StatusNotification';

interface StatusMetrics {
  uptime: number; // percentage
  totalConnections: number;
  activeConnections: number;
  averageResponseTime: number; // in ms
  lastUpdate: Date;
}

interface StatusDashboardProps {
  currentStatus: StatusType;
  metrics: StatusMetrics;
  history: StatusHistoryItem[];
  showNotifications?: boolean;
  showMetrics?: boolean;
  showHistory?: boolean;
  compact?: boolean;
  className?: string;
}

const StatusDashboard: React.FC<StatusDashboardProps> = ({
  currentStatus,
  metrics,
  history,
  showNotifications = true,
  showMetrics = true,
  showHistory = true,
  compact = false,
  className,
}) => {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    status: StatusType;
    title: string;
    message?: string;
  }>>([]);

  // Add notification when status changes
  useEffect(() => {
    if (history.length > 0) {
      const latestItem = history[0];
      const notification = {
        id: `notification-${Date.now()}`,
        status: latestItem.status,
        title: `Status alterado para ${latestItem.status}`,
        message: latestItem.message,
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep max 3 notifications
    }
  }, [history]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-success';
    if (uptime >= 95) return 'text-warning';
    return 'text-error';
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime <= 100) return 'text-success';
    if (responseTime <= 500) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Notifications */}
      {showNotifications && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          <AnimatePresence>
            {notifications.map((notification) => (
              <StatusNotification
                key={notification.id}
                status={notification.status}
                title={notification.title}
                message={notification.message}
                onClose={() => removeNotification(notification.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Current Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Status Atual</h3>
          <StatusBadgeEnhanced
            status={currentStatus}
            size={compact ? 'md' : 'lg'}
            variant="prominent"
            showTimestamp={true}
            timestamp={metrics.lastUpdate}
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className={cn('text-2xl font-bold', getUptimeColor(metrics.uptime))}>
              {metrics.uptime.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {metrics.activeConnections}/{metrics.totalConnections}
            </div>
            <div className="text-sm text-muted-foreground">Conexões</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className={cn('text-2xl font-bold', getResponseTimeColor(metrics.averageResponseTime))}>
              {metrics.averageResponseTime}ms
            </div>
            <div className="text-sm text-muted-foreground">Resposta</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {history.filter(h => h.status === 'error').length}
            </div>
            <div className="text-sm text-muted-foreground">Erros (24h)</div>
          </div>
        </div>
      </Card>

      {/* Status History */}
      {showHistory && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Histórico de Status</h3>
            <span className="text-sm text-muted-foreground">
              Últimas {Math.min(history.length, 10)} alterações
            </span>
          </div>
          
          <StatusHistory
            items={history}
            maxItems={compact ? 5 : 10}
            showDuration={true}
            showMessages={!compact}
            compact={compact}
          />
        </Card>
      )}

      {/* Metrics Chart Placeholder */}
      {showMetrics && !compact && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Métricas de Performance</h3>
          <div className="h-48 bg-muted/20 rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Gráfico de métricas em tempo real</p>
              <p className="text-xs">Implementação futura</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default StatusDashboard;
export type { StatusMetrics };