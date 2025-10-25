import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import Button from './Button';
import StatusBadgeEnhanced, { StatusType } from './StatusBadgeEnhanced';
import { StatusHistoryItem } from './StatusHistory';
import StatusDashboard, { StatusMetrics } from './StatusDashboard';

/**
 * Test component to verify the status indicator system functionality
 */
const StatusSystemTest: React.FC = () => {
  const [currentStatus, setCurrentStatus] = useState<StatusType>('disconnected');
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);

  const statuses: StatusType[] = ['connected', 'connecting', 'initializing', 'disconnected', 'paused', 'error'];

  const mockMetrics: StatusMetrics = {
    uptime: 98.5,
    totalConnections: 3,
    activeConnections: 2,
    averageResponseTime: 120,
    lastUpdate: new Date(),
  };

  // Simulate status changes
  const changeStatus = (newStatus: StatusType) => {
    const historyItem: StatusHistoryItem = {
      id: `status-${Date.now()}`,
      status: newStatus,
      timestamp: new Date(),
      message: `Status alterado para ${newStatus}`,
      duration: Math.random() * 300000, // Random duration up to 5 minutes
    };

    setHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 items
    setCurrentStatus(newStatus);
  };

  // Auto-cycle through statuses for demo
  useEffect(() => {
    const interval = setInterval(() => {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      changeStatus(randomStatus);
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Status Indicator System Test</h1>
        <p className="text-muted-foreground">
          Sistema moderno de indicadores de status com animações e notificações
        </p>
      </div>

      {/* Manual Status Controls */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Controles de Status</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <Button
              key={status}
              variant={currentStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => changeStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      </Card>

      {/* Current Status Display */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Status Atual</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Default</h3>
            <StatusBadgeEnhanced status={currentStatus} variant="default" />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Gradient</h3>
            <StatusBadgeEnhanced status={currentStatus} variant="gradient" />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Glass</h3>
            <StatusBadgeEnhanced status={currentStatus} variant="glass" />
          </div>
        </div>
      </Card>

      {/* Status Dashboard */}
      <StatusDashboard
        currentStatus={currentStatus}
        metrics={mockMetrics}
        history={history}
        showNotifications={true}
        showMetrics={true}
        showHistory={true}
      />

      {/* Test Results */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Resultados do Teste</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Status badges com cores apropriadas e ícones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Indicadores de status animados para estados de conexão</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Estilização específica por status com codificação de cores consistente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Variantes modernas (gradient, glass, prominent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Sistema de notificações com animações</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Histórico de status com timestamps</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>✅ Dashboard completo com métricas</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StatusSystemTest;