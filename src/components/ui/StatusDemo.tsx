import React, { useState } from 'react';
import { Card } from './Card';
import Button from './Button';
import StatusBadge, { StatusType } from './StatusBadge';
import StatusIndicator from './StatusIndicator';
import StatusSystem from './StatusSystem';
import StatusBadgeEnhanced from './StatusBadgeEnhanced';
import StatusNotification from './StatusNotification';
import StatusHistory, { StatusHistoryItem } from './StatusHistory';
import StatusDashboard, { StatusMetrics } from './StatusDashboard';

const StatusDemo: React.FC = () => {
  const [currentStatus, setCurrentStatus] = useState<StatusType>('connected');
  const [showNotification, setShowNotification] = useState(false);
  
  const statuses: StatusType[] = ['connected', 'connecting', 'initializing', 'disconnected', 'paused', 'error'];

  // Mock data for enhanced components
  const mockHistory: StatusHistoryItem[] = [
    {
      id: '1',
      status: 'connected',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      message: 'Conexão estabelecida com sucesso',
      duration: 300000,
    },
    {
      id: '2',
      status: 'connecting',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      message: 'Tentando reconectar após falha',
      duration: 30000,
    },
    {
      id: '3',
      status: 'error',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      message: 'Erro de autenticação detectado',
      duration: 5000,
    },
    {
      id: '4',
      status: 'paused',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      message: 'Pausado pelo usuário',
      duration: 600000,
    },
  ];

  const mockMetrics: StatusMetrics = {
    uptime: 99.2,
    totalConnections: 5,
    activeConnections: 4,
    averageResponseTime: 150,
    lastUpdate: new Date(),
  };

  return (
    <div className="p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Status Indicator System Demo</h2>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {statuses.map((status) => (
            <Button
              key={status}
              variant={currentStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Badge Variants */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Status Badge Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Default</h4>
            <div className="space-y-3">
              <StatusBadge status={currentStatus} size="sm" variant="default" />
              <StatusBadge status={currentStatus} size="md" variant="default" />
              <StatusBadge status={currentStatus} size="lg" variant="default" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Minimal</h4>
            <div className="space-y-3">
              <StatusBadge status={currentStatus} size="sm" variant="minimal" />
              <StatusBadge status={currentStatus} size="md" variant="minimal" />
              <StatusBadge status={currentStatus} size="lg" variant="minimal" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Prominent</h4>
            <div className="space-y-3">
              <StatusBadge status={currentStatus} size="sm" variant="prominent" />
              <StatusBadge status={currentStatus} size="md" variant="prominent" />
              <StatusBadge status={currentStatus} size="lg" variant="prominent" />
            </div>
          </div>
        </div>
      </Card>

      {/* Status Indicator Variants */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Status Indicator Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Dot</h4>
            <div className="flex items-center gap-3">
              <StatusIndicator status={currentStatus} variant="dot" size="sm" />
              <StatusIndicator status={currentStatus} variant="dot" size="md" />
              <StatusIndicator status={currentStatus} variant="dot" size="lg" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Icon</h4>
            <div className="flex items-center gap-3">
              <StatusIndicator status={currentStatus} variant="icon" size="sm" />
              <StatusIndicator status={currentStatus} variant="icon" size="md" />
              <StatusIndicator status={currentStatus} variant="icon" size="lg" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Full</h4>
            <div className="space-y-2">
              <StatusIndicator status={currentStatus} variant="full" size="sm" />
              <StatusIndicator status={currentStatus} variant="full" size="md" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Accent Bar</h4>
            <div className="space-y-3">
              <div className="relative h-8 bg-card border rounded p-2">
                <StatusIndicator status={currentStatus} variant="accent-bar" size="sm" />
                <span className="ml-3 text-sm">Small</span>
              </div>
              <div className="relative h-10 bg-card border rounded p-2">
                <StatusIndicator status={currentStatus} variant="accent-bar" size="md" />
                <span className="ml-4 text-sm">Medium</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Status System Layouts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Status System Layouts</h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Horizontal Layout</h4>
            <StatusSystem
              status={currentStatus}
              layout="horizontal"
              showAccentBar={true}
              showPulse={true}
              className="p-4 border rounded-lg"
            >
              <div>
                <h5 className="font-medium">Connection Instance</h5>
                <p className="text-sm text-muted-foreground">+55 11 99999-9999</p>
              </div>
            </StatusSystem>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Vertical Layout</h4>
            <StatusSystem
              status={currentStatus}
              layout="vertical"
              showAccentBar={true}
              showPulse={true}
              className="p-4 border rounded-lg max-w-xs"
            >
              <div>
                <h5 className="font-medium">Connection Instance</h5>
                <p className="text-sm text-muted-foreground">+55 11 99999-9999</p>
              </div>
            </StatusSystem>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Compact Layout</h4>
            <StatusSystem
              status={currentStatus}
              layout="compact"
              showAccentBar={true}
              showPulse={true}
              size="sm"
              className="p-3 border rounded-lg max-w-sm"
            >
              <span className="text-sm font-medium">Instance Name</span>
            </StatusSystem>
          </div>
        </div>
      </Card>

      {/* Enhanced Status Badges */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Enhanced Status Badges</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Gradient Variant</h4>
            <div className="space-y-3">
              <StatusBadgeEnhanced status={currentStatus} size="sm" variant="gradient" />
              <StatusBadgeEnhanced status={currentStatus} size="md" variant="gradient" />
              <StatusBadgeEnhanced status={currentStatus} size="lg" variant="gradient" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Glass Variant</h4>
            <div className="space-y-3">
              <StatusBadgeEnhanced status={currentStatus} size="sm" variant="glass" />
              <StatusBadgeEnhanced status={currentStatus} size="md" variant="glass" />
              <StatusBadgeEnhanced status={currentStatus} size="lg" variant="glass" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">With Timestamp</h4>
            <div className="space-y-3">
              <StatusBadgeEnhanced 
                status={currentStatus} 
                size="sm" 
                variant="prominent" 
                showTimestamp={true}
                timestamp={new Date(Date.now() - 5 * 60 * 1000)}
              />
              <StatusBadgeEnhanced 
                status={currentStatus} 
                size="md" 
                variant="prominent" 
                showTimestamp={true}
                timestamp={new Date(Date.now() - 30 * 60 * 1000)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Status Notification */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Status Notifications</h3>
          <Button
            onClick={() => setShowNotification(true)}
            variant="outline"
            size="sm"
          >
            Mostrar Notificação
          </Button>
        </div>
        
        {showNotification && (
          <StatusNotification
            status={currentStatus}
            title="Status atualizado"
            message="O status da conexão foi alterado com sucesso"
            onClose={() => setShowNotification(false)}
          />
        )}
      </Card>

      {/* Status History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Status History</h3>
        <StatusHistory
          items={mockHistory}
          maxItems={5}
          showDuration={true}
          showMessages={true}
        />
      </Card>

      {/* Status Dashboard */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Status Dashboard</h3>
        <StatusDashboard
          currentStatus={currentStatus}
          metrics={mockMetrics}
          history={mockHistory}
          showNotifications={false}
          showMetrics={true}
          showHistory={true}
          compact={false}
        />
      </Card>

      {/* Animation Examples */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Animation Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Connecting State</h4>
            <div className="space-y-3">
              <StatusBadge status="connecting" size="md" variant="prominent" showPulse={true} />
              <StatusIndicator status="connecting" variant="full" size="md" showAnimation={true} />
              <StatusBadgeEnhanced status="connecting" size="md" variant="glass" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Initializing State</h4>
            <div className="space-y-3">
              <StatusBadge status="initializing" size="md" variant="prominent" showPulse={true} />
              <StatusIndicator status="initializing" variant="full" size="md" showAnimation={true} />
              <StatusBadgeEnhanced status="initializing" size="md" variant="gradient" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StatusDemo;