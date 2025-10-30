import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  isLoading: boolean;
  lastSyncTime?: Date;
  error?: string | null;
  onManualSync?: () => void;
  className?: string;
  showLastSync?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  isLoading,
  lastSyncTime,
  error,
  onManualSync,
  className,
  showLastSync = true
}) => {
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) {
      return 'Agora mesmo';
    } else if (minutes < 60) {
      return `${minutes}min atrás`;
    } else if (hours < 24) {
      return `${hours}h atrás`;
    } else {
      return lastSyncTime.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getSyncIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    
    if (error) {
      return <AlertCircle className="w-4 h-4" />;
    }
    
    if (lastSyncTime) {
      return <CheckCircle className="w-4 h-4" />;
    }
    
    return <Info className="w-4 h-4" />;
  };

  const getSyncText = () => {
    if (isLoading) {
      return 'Sincronizando...';
    }
    
    if (error) {
      return 'Erro na sincronização';
    }
    
    return 'Sincronizar';
  };

  const getSyncColor = () => {
    if (isLoading) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
    
    if (error) {
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    }
    
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700';
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Sync button */}
      <button
        onClick={onManualSync}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          getSyncColor()
        )}
        title={error ? `Erro: ${error}` : 'Sincronizar conversas manualmente'}
      >
        {getSyncIcon()}
        <span className="whitespace-nowrap">{getSyncText()}</span>
      </button>

      {/* Last sync time */}
      {showLastSync && lastSyncTime && !isLoading && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>Última sync: {formatLastSync()}</span>
        </div>
      )}

      {/* Error details */}
      {error && !isLoading && (
        <div className="text-xs text-red-500 dark:text-red-400 max-w-xs truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  );
};

export default SyncStatus;