import React from 'react';
import { Wifi, WifiOff, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  connectionQuality: 'good' | 'poor' | 'disconnected';
  lastHeartbeat: Date | null;
  reconnectionState: {
    isReconnecting: boolean;
    attempts: number;
    maxAttempts: number;
    nextRetryIn: number;
    lastError: string | null;
  };
  onForceReconnect?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  connectionQuality,
  lastHeartbeat,
  reconnectionState,
  onForceReconnect,
  className,
  showDetails = false
}) => {
  const getStatusIcon = () => {
    if (reconnectionState.isReconnecting) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    
    if (!isConnected) {
      return <WifiOff className="w-4 h-4" />;
    }
    
    if (connectionQuality === 'poor') {
      return <AlertTriangle className="w-4 h-4" />;
    }
    
    return <Wifi className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (reconnectionState.isReconnecting) {
      const remainingSeconds = Math.ceil(reconnectionState.nextRetryIn / 1000);
      return `Reconectando... (${reconnectionState.attempts}/${reconnectionState.maxAttempts}) ${remainingSeconds > 0 ? `em ${remainingSeconds}s` : ''}`;
    }
    
    if (!isConnected) {
      return 'Desconectado';
    }
    
    if (connectionQuality === 'poor') {
      return 'Conexão lenta';
    }
    
    return 'Online';
  };

  const getStatusColor = () => {
    if (reconnectionState.isReconnecting) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
    
    if (!isConnected) {
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    }
    
    if (connectionQuality === 'poor') {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    }
    
    return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
  };

  const getIndicatorColor = () => {
    if (reconnectionState.isReconnecting) {
      return 'bg-blue-500';
    }
    
    if (!isConnected) {
      return 'bg-red-500';
    }
    
    if (connectionQuality === 'poor') {
      return 'bg-yellow-500';
    }
    
    return 'bg-green-500 animate-pulse';
  };

  const formatLastHeartbeat = () => {
    if (!lastHeartbeat) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - lastHeartbeat.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds}s atrás`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}min atrás`;
    } else {
      return lastHeartbeat.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Status indicator with icon */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
        getStatusColor()
      )}>
        <div className={cn("w-2 h-2 rounded-full", getIndicatorColor())} />
        {getStatusIcon()}
        <span className="whitespace-nowrap">{getStatusText()}</span>
      </div>

      {/* Detailed status information */}
      {showDetails && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {lastHeartbeat && (
            <div className="flex items-center gap-1" title={`Último heartbeat: ${lastHeartbeat.toLocaleTimeString()}`}>
              <Clock className="w-3 h-3" />
              <span>{formatLastHeartbeat()}</span>
            </div>
          )}
          
          {reconnectionState.lastError && !isConnected && (
            <div className="text-red-500 dark:text-red-400 max-w-xs truncate" title={reconnectionState.lastError}>
              Erro: {reconnectionState.lastError}
            </div>
          )}
        </div>
      )}

      {/* Manual reconnect button */}
      {!isConnected && !reconnectionState.isReconnecting && onForceReconnect && (
        <button
          onClick={onForceReconnect}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
          title="Tentar reconectar manualmente"
        >
          <RefreshCw className="w-3 h-3" />
          Reconectar
        </button>
      )}
    </div>
  );
};

export default ConnectionStatus;