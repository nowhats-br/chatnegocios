import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Atendimentos from '@/pages/Atendimentos';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { dbClient } from '@/lib/dbClient';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useWebSocket');
vi.mock('@/lib/dbClient');
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    permission: 'granted',
    showNotification: vi.fn(),
    playNotificationSound: vi.fn()
  })
}));
vi.mock('sonner');

// Mock data
const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockConversations = [
  {
    id: 'conv-1',
    contact_id: 'contact-1',
    connection_id: 'conn-1',
    status: 'pending' as const,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    user_id: 'test-user-id',
    contacts: {
      name: 'Test Contact',
      phone_number: '1234567890',
      avatar_url: null
    }
  }
];

const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    content: 'Test message',
    created_at: '2024-01-01T10:00:00Z',
    sender_is_user: false,
    message_type: 'text' as const,
    user_id: 'test-user-id'
  }
];

// Mock WebSocket hook
const mockWebSocketHook = {
  isConnected: true,
  connectionError: null,
  connectionQuality: 'good' as const,
  lastHeartbeat: new Date(),
  reconnectAttempts: 0,
  reconnectionState: {
    isReconnecting: false,
    attempts: 0,
    maxAttempts: 10,
    nextRetryIn: 0,
    lastError: null,
    backoffDelay: 1000,
    baseDelay: 1000,
    maxDelay: 30000
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  forceReconnect: vi.fn(),
  setupWebhookForInstance: vi.fn(),
  sendAcknowledgment: vi.fn(),
  setOnNewMessage: vi.fn(),
  setOnConnectionUpdate: vi.fn(),
  setOnQRCodeUpdate: vi.fn(),
  setOnSyncComplete: vi.fn(),
  requestSync: vi.fn()
};

// Mock notifications hook
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    permission: 'granted',
    showNotification: vi.fn(),
    playNotificationSound: vi.fn()
  })
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Sync Functionality Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAuth
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: null,
      loading: false,
      logout: vi.fn()
    });
    
    // Mock useWebSocket
    vi.mocked(useWebSocket).mockReturnValue(mockWebSocketHook);
    
    // Mock dbClient methods
    vi.mocked(dbClient.conversations.listWithContact).mockResolvedValue(mockConversations);
    vi.mocked(dbClient.conversations.sync).mockResolvedValue({
      conversations: mockConversations,
      totalFound: 1,
      hasMore: false,
      syncTimestamp: new Date().toISOString()
    });
    vi.mocked(dbClient.messages.listByConversation).mockResolvedValue(mockMessages);
    
    // Mock toast
    vi.mocked(toast.success).mockReturnValue({} as any);
    vi.mocked(toast.error).mockReturnValue({} as any);
    vi.mocked(toast.info).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Manual Sync Button', () => {
    it('should render sync button', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Find sync button
      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      expect(syncButton).toBeInTheDocument();
    });

    it('should call sync when sync button is clicked', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should call requestSync from WebSocket hook
      expect(mockWebSocketHook.requestSync).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      // Mock sync to return null (WebSocket not available)
      mockWebSocketHook.requestSync.mockReturnValue(null);
      vi.mocked(dbClient.conversations.sync).mockRejectedValue(new Error('Sync failed'));

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should show error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Erro ao buscar conversas',
          expect.objectContaining({
            description: expect.stringContaining('Sync failed')
          })
        );
      });
    });
  });

  describe('WebSocket Message Flow', () => {
    it('should register WebSocket callbacks on component mount', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Should register all WebSocket callbacks
      expect(mockWebSocketHook.setOnNewMessage).toHaveBeenCalled();
      expect(mockWebSocketHook.setOnConnectionUpdate).toHaveBeenCalled();
      expect(mockWebSocketHook.setOnSyncComplete).toHaveBeenCalled();
    });

    it('should handle sync complete events from WebSocket', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the sync complete callback
      const setOnSyncCompleteCall = mockWebSocketHook.setOnSyncComplete.mock.calls[0];
      const syncCompleteCallback = setOnSyncCompleteCall[0];

      // Simulate sync complete event with success
      const syncData = {
        success: true,
        conversations: mockConversations,
        totalFound: 1,
        syncTimestamp: new Date().toISOString()
      };

      syncCompleteCallback(syncData);

      // Should show success message
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Sincronização concluída',
          expect.objectContaining({
            description: expect.stringContaining('1 conversas atualizadas via WebSocket')
          })
        );
      });
    });
  });

  describe('Connection Status', () => {
    it('should show online status when connected', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });

    it('should show disconnected status when offline', async () => {
      // Mock disconnected state
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
        connectionQuality: 'disconnected'
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show disconnected status
      await waitFor(() => {
        expect(screen.getByText(/Desconectado/i)).toBeInTheDocument();
      });
    });

    it('should show reconnecting status during reconnection', async () => {
      // Mock reconnecting state
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
        connectionQuality: 'poor',
        reconnectionState: {
          ...mockWebSocketHook.reconnectionState,
          isReconnecting: true,
          attempts: 1
        }
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show reconnecting status
      await waitFor(() => {
        expect(screen.getByText(/Reconectando/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sync Integration', () => {
    it('should handle WebSocket sync response', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the sync complete callback
      const setOnSyncCompleteCall = mockWebSocketHook.setOnSyncComplete.mock.calls[0];
      const syncCompleteCallback = setOnSyncCompleteCall[0];

      // Simulate sync complete event with no conversations
      const syncData = {
        success: true,
        conversations: [],
        totalFound: 0,
        syncTimestamp: new Date().toISOString()
      };

      syncCompleteCallback(syncData);

      // Should show info message for no conversations
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith(
          'Sincronização concluída',
          expect.objectContaining({
            description: 'Nenhuma conversa nova encontrada'
          })
        );
      });
    });

    it('should handle sync errors from WebSocket', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the sync complete callback
      const setOnSyncCompleteCall = mockWebSocketHook.setOnSyncComplete.mock.calls[0];
      const syncCompleteCallback = setOnSyncCompleteCall[0];

      // Simulate sync error
      const syncData = {
        success: false,
        error: 'Erro de sincronização',
        syncTimestamp: new Date().toISOString()
      };

      syncCompleteCallback(syncData);

      // Should show error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Erro na sincronização',
          expect.objectContaining({
            description: 'Erro de sincronização'
          })
        );
      });
    });

    it('should handle incremental sync updates', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the sync complete callback
      const setOnSyncCompleteCall = mockWebSocketHook.setOnSyncComplete.mock.calls[0];
      const syncCompleteCallback = setOnSyncCompleteCall[0];

      // Simulate incremental sync with new conversations
      const newConversations = [
        {
          ...mockConversations[0],
          id: 'conv-new',
          updated_at: new Date().toISOString(),
          contacts: {
            name: 'New Contact',
            phone_number: '1234567890',
            avatar_url: null
          }
        }
      ];

      const syncData = {
        success: true,
        conversations: newConversations,
        totalFound: 1,
        syncTimestamp: new Date().toISOString()
      };

      syncCompleteCallback(syncData);

      // Should show success message with count
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Sincronização concluída',
          expect.objectContaining({
            description: '1 conversas atualizadas via WebSocket'
          })
        );
      });
    });
  });

  describe('End-to-End Message Flow', () => {
    it('should handle complete webhook to UI message flow', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the new message callback
      const setOnNewMessageCall = mockWebSocketHook.setOnNewMessage.mock.calls[0];
      const newMessageCallback = setOnNewMessageCall[0];

      // Simulate webhook message flow
      const webhookMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-webhook-1',
        content: 'Message from webhook',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      // Simulate message received via WebSocket
      act(() => {
        newMessageCallback(webhookMessage);
      });

      // Should update conversation list with new message
      await waitFor(() => {
        expect(screen.getByText(/Message from webhook/)).toBeInTheDocument();
      });

      // Should show unread indicator
      expect(screen.getByText('Novo')).toBeInTheDocument();
    });

    it('should handle message deduplication', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the new message callback
      const setOnNewMessageCall = mockWebSocketHook.setOnNewMessage.mock.calls[0];
      const newMessageCallback = setOnNewMessageCall[0];

      const duplicateMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-duplicate',
        content: 'Duplicate message',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      // Send same message twice
      act(() => {
        newMessageCallback(duplicateMessage);
        newMessageCallback(duplicateMessage);
      });

      // Should only process once (no duplicate notifications)
      await waitFor(() => {
        expect(screen.getByText(/Duplicate message/)).toBeInTheDocument();
      });

      // Verify conversation was updated only once
      const conversationElements = screen.getAllByText(/Duplicate message/);
      expect(conversationElements).toHaveLength(1);
    });
  });

  describe('Offline/Online Scenarios', () => {
    it('should handle offline to online transition', async () => {
      // Start with offline state
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
        connectionQuality: 'disconnected'
      });

      const { rerender } = render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show disconnected status
      await waitFor(() => {
        expect(screen.getByText(/Desconectado/i)).toBeInTheDocument();
      });

      // Simulate going online
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: true,
        connectionQuality: 'good'
      });

      rerender(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show online status
      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });

    it('should handle poor connection quality', async () => {
      // Mock poor connection
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: true,
        connectionQuality: 'poor'
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show poor connection indicator
      await waitFor(() => {
        expect(screen.getByText(/Conexão lenta/i)).toBeInTheDocument();
      });
    });

    it('should handle reconnection attempts', async () => {
      // Mock reconnecting state
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
        connectionQuality: 'disconnected',
        reconnectionState: {
          isReconnecting: true,
          attempts: 2,
          maxAttempts: 10,
          nextRetryIn: 5000,
          lastError: 'Connection lost',
          backoffDelay: 2000,
          baseDelay: 1000,
          maxDelay: 30000
        }
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Should show reconnecting status
      await waitFor(() => {
        expect(screen.getByText(/Reconectando/i)).toBeInTheDocument();
      });

      // Should show attempt count in reconnection status
      expect(screen.getByText(/Reconectando.*2\/10/i)).toBeInTheDocument();
    });

    it('should handle manual reconnection', async () => {
      const mockForceReconnect = vi.fn();
      
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
        connectionQuality: 'disconnected',
        forceReconnect: mockForceReconnect
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      // Find and click reconnect button
      const reconnectButton = screen.getByRole('button', { name: /reconectar/i });
      fireEvent.click(reconnectButton);

      // Should call force reconnect
      expect(mockForceReconnect).toHaveBeenCalled();
    });
  });

  describe('Message Queuing', () => {
    it('should handle queued messages when coming back online', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get callbacks
      const setOnNewMessageCall = mockWebSocketHook.setOnNewMessage.mock.calls[0];
      const newMessageCallback = setOnNewMessageCall[0];
      
      const setOnConnectionUpdateCall = mockWebSocketHook.setOnConnectionUpdate.mock.calls[0];
      const connectionUpdateCallback = setOnConnectionUpdateCall[0];

      // Simulate multiple queued messages when reconnecting
      const queuedMessages = [
        {
          conversationId: 'conv-1',
          contactId: 'contact-1',
          contactName: 'Test Contact',
          contactPhone: '1234567890',
          messageId: 'msg-queued-1',
          content: 'Queued message 1',
          messageType: 'text',
          timestamp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          isRetry: true,
          retryCount: 1
        },
        {
          conversationId: 'conv-1',
          contactId: 'contact-1',
          contactName: 'Test Contact',
          contactPhone: '1234567890',
          messageId: 'msg-queued-2',
          content: 'Queued message 2',
          messageType: 'text',
          timestamp: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          isRetry: true,
          retryCount: 1
        }
      ];

      // Simulate connection restored
      act(() => {
        connectionUpdateCallback({
          instanceName: 'test-instance',
          status: 'CONNECTED'
        });
      });

      // Simulate queued messages being delivered
      act(() => {
        queuedMessages.forEach(msg => newMessageCallback(msg));
      });

      // Should process all queued messages (check for the latest message in conversation list)
      await waitFor(() => {
        expect(screen.getByText(/Queued message 2/)).toBeInTheDocument();
      });
    });

    it('should handle message retry scenarios', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the new message callback
      const setOnNewMessageCall = mockWebSocketHook.setOnNewMessage.mock.calls[0];
      const newMessageCallback = setOnNewMessageCall[0];

      // Simulate retry message (should not show notification to avoid spam)
      const retryMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-retry',
        content: 'Retry message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        isRetry: true,
        retryCount: 2
      };

      act(() => {
        newMessageCallback(retryMessage);
      });

      // Should update UI but not show notification (isRetry = true)
      await waitFor(() => {
        expect(screen.getByText(/Retry message/)).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Display', () => {
    it('should display conversations when available', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Should display conversation (checking for ticket ID since that's what's actually rendered)
      await waitFor(() => {
        expect(screen.getByText(/Ticket #conv-1/)).toBeInTheDocument();
      });
    });

    it('should show empty state when no conversations', async () => {
      // Mock empty conversations
      vi.mocked(dbClient.conversations.listWithContact).mockResolvedValue([]);

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Aguardando Tickets')).toBeInTheDocument();
      });
    });

    it('should update conversation list when new message arrives', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Get the new message callback
      const setOnNewMessageCall = mockWebSocketHook.setOnNewMessage.mock.calls[0];
      const newMessageCallback = setOnNewMessageCall[0];

      // Simulate new message for existing conversation
      const newMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-new',
        content: 'New incoming message',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      act(() => {
        newMessageCallback(newMessage);
      });

      // Should update conversation with new message
      await waitFor(() => {
        expect(screen.getByText(/New incoming message/)).toBeInTheDocument();
      });

      // Should show unread indicator
      expect(screen.getByText('Novo')).toBeInTheDocument();
    });

    it('should handle conversation selection', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      // Click on conversation
      const conversationElement = screen.getByText(/Ticket #conv-1/);
      fireEvent.click(conversationElement.closest('[role="button"], div[class*="cursor-pointer"]') || conversationElement);

      // Should load messages for selected conversation
      await waitFor(() => {
        expect(dbClient.messages.listByConversation).toHaveBeenCalledWith('conv-1');
      });
    });

    it('should show conversation status correctly', async () => {
      // Mock conversation with different status
      const resolvedConversation = {
        ...mockConversations[0],
        status: 'resolved' as const
      };

      vi.mocked(dbClient.conversations.listWithContact).mockResolvedValue([resolvedConversation]);

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Resolvido/)).toBeInTheDocument();
      });
    });
  });

  describe('Sync Button Functionality', () => {
    it('should show sync button in different states', async () => {
      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sincronizar/i })).toBeInTheDocument();
      });
    });

    it('should handle sync button click with WebSocket available', async () => {
      const mockRequestSync = vi.fn().mockReturnValue('sync-correlation-id');
      
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        requestSync: mockRequestSync
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should call WebSocket sync
      expect(mockRequestSync).toHaveBeenCalled();
    });

    it('should fallback to REST sync when WebSocket unavailable', async () => {
      const mockRequestSync = vi.fn().mockReturnValue(null); // WebSocket not available
      
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        requestSync: mockRequestSync
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should fallback to REST sync
      await waitFor(() => {
        expect(dbClient.conversations.sync).toHaveBeenCalled();
      });
    });

    it('should show loading state during sync', async () => {
      // Mock slow sync response
      vi.mocked(dbClient.conversations.sync).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          conversations: [],
          totalFound: 0,
          hasMore: false,
          syncTimestamp: new Date().toISOString()
        }), 100))
      );

      const mockRequestSync = vi.fn().mockReturnValue(null);
      
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        requestSync: mockRequestSync
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should show loading state
      expect(screen.getByText(/Sincronizando conversas/)).toBeInTheDocument();

      // Wait for sync to complete
      await waitFor(() => {
        expect(screen.queryByText(/Sincronizando conversas/)).not.toBeInTheDocument();
      });
    });

    it('should handle sync timeout scenarios', async () => {
      // Mock sync that takes a long time but eventually resolves
      vi.mocked(dbClient.conversations.sync).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          conversations: [],
          totalFound: 0,
          hasMore: false,
          syncTimestamp: new Date().toISOString()
        }), 100))
      );

      const mockRequestSync = vi.fn().mockReturnValue(null);
      
      vi.mocked(useWebSocket).mockReturnValue({
        ...mockWebSocketHook,
        requestSync: mockRequestSync
      });

      render(
        <TestWrapper>
          <Atendimentos />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Caixa de Entrada')).toBeInTheDocument();
      });

      const syncButton = screen.getByRole('button', { name: /sincronizar/i });
      fireEvent.click(syncButton);

      // Should show loading state briefly
      expect(screen.getByText(/Sincronizando conversas/)).toBeInTheDocument();

      // Wait for sync to complete
      await waitFor(() => {
        expect(screen.queryByText(/Sincronizando conversas/)).not.toBeInTheDocument();
      });
    });
  });
});