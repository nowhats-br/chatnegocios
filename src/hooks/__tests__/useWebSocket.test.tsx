import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '../useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('sonner');

// Mock socket.io-client with factory function
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn()
  }))
}));

describe('useWebSocket', () => {
  const mockUser = { id: 'test-user-id' };
  let mockSocket: any;
  let mockIo: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked io function
    const { io } = await import('socket.io-client');
    mockIo = vi.mocked(io);
    
    // Create fresh mock socket for each test
    mockSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn()
    };
    
    // Make io return our mock socket
    mockIo.mockReturnValue(mockSocket);
    
    // Mock useAuth to return authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false
    });
    
    // Mock toast
    vi.mocked(toast).mockReturnValue({} as any);
    vi.mocked(toast.success).mockReturnValue({} as any);
    vi.mocked(toast.error).mockReturnValue({} as any);
    vi.mocked(toast.info).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() => useWebSocket());
      
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionError).toBe(null);
      expect(result.current.connectionQuality).toBe('disconnected');
      expect(result.current.lastHeartbeat).toBe(null);
      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('should connect when user is authenticated', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Verify io was called with correct parameters
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        })
      );
      
      // Verify socket event listeners were set up
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should not connect when user is not authenticated', () => {
      // Mock unauthenticated state
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false
      });
      
      const { result } = renderHook(() => useWebSocket());
      
      // Should not attempt connection
      expect(mockIo).not.toHaveBeenCalled();
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle successful connection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionError).toBe(null);
        expect(result.current.connectionQuality).toBe('good');
      });
      
      // Should emit register event
      expect(mockSocket.emit).toHaveBeenCalledWith('register', mockUser.id);
    });

    it('should handle connection errors', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const error = new Error('Connection failed');
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
      
      act(() => {
        errorHandler?.(error);
      });
      
      await waitFor(() => {
        expect(result.current.connectionError).toBe('Connection failed');
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionQuality).toBe('disconnected');
        expect(result.current.reconnectionState.isReconnecting).toBe(true);
      }, { timeout: 2000 });
    });

    it('should handle disconnection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      act(() => {
        mockSocket.connected = false;
        disconnectHandler?.('transport close');
      });
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionQuality).toBe('disconnected');
        expect(result.current.lastHeartbeat).toBe(null);
      });
    });
  });

  describe('Message Handling', () => {
    it('should register and execute new message callback', async () => {
      const { result } = renderHook(() => useWebSocket());
      const mockCallback = vi.fn();
      
      // Set callback
      act(() => {
        result.current.setOnNewMessage(mockCallback);
      });
      
      // Simulate message reception
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'new_message')?.[1];
      const testMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-1',
        content: 'Test message',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };
      
      act(() => {
        messageHandler?.(testMessage);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(testMessage);
      });
    });

    it('should prevent duplicate message processing', async () => {
      const { result } = renderHook(() => useWebSocket());
      const mockCallback = vi.fn();
      
      act(() => {
        result.current.setOnNewMessage(mockCallback);
      });
      
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'new_message')?.[1];
      const testMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-1',
        content: 'Test message',
        messageType: 'text',
        timestamp: new Date().toISOString()
      };
      
      // Send same message twice
      act(() => {
        messageHandler?.(testMessage);
        messageHandler?.(testMessage);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });
    });

    it('should send acknowledgment for messages requiring ack', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'new_message')?.[1];
      const testMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-1',
        content: 'Test message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        requiresAck: true,
        correlationId: 'corr-1'
      };
      
      // Mock connected socket
      mockSocket.connected = true;
      
      act(() => {
        messageHandler?.(testMessage);
      });
      
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('message_ack', {
          messageId: 'msg-1',
          correlationId: 'corr-1',
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Heartbeat System', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should handle heartbeat acknowledgment', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect to enable heartbeat
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      const heartbeatAckHandler = mockSocket.on.mock.calls.find(call => call[0] === 'heartbeat_ack')?.[1];
      const heartbeatData = {
        timestamp: new Date().toISOString(),
        latency: 100
      };
      
      act(() => {
        heartbeatAckHandler?.(heartbeatData);
      });
      
      await waitFor(() => {
        expect(result.current.lastHeartbeat).toBeInstanceOf(Date);
        expect(result.current.connectionQuality).toBe('good');
      }, { timeout: 1000 });
    });

    it('should respond to server heartbeat', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect to enable heartbeat
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      const serverHeartbeatHandler = mockSocket.on.mock.calls.find(call => call[0] === 'server_heartbeat')?.[1];
      const heartbeatData = {
        timestamp: new Date().toISOString(),
        serverId: 'server-1'
      };
      
      act(() => {
        serverHeartbeatHandler?.(heartbeatData);
      });
      
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('server_heartbeat_response', {
          serverTimestamp: heartbeatData.timestamp,
          clientTimestamp: expect.any(String),
          serverId: 'server-1'
        });
        expect(result.current.lastHeartbeat).toBeInstanceOf(Date);
        expect(result.current.connectionQuality).toBe('good');
      }, { timeout: 1000 });
    });
  });

  describe('Manual Operations', () => {
    it('should allow manual disconnect', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      // Then manually disconnect
      act(() => {
        result.current.disconnect();
      });
      
      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled();
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionQuality).toBe('disconnected');
      });
    });

    it('should allow force reconnect', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      act(() => {
        result.current.forceReconnect();
      });
      
      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
    });

    it('should allow manual sync request', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Mock connected socket
      mockSocket.connected = true;
      
      const lastSyncTimestamp = new Date().toISOString();
      let correlationId: string | null = null;
      
      act(() => {
        correlationId = result.current.requestSync(lastSyncTimestamp);
      });
      
      expect(correlationId).toBeTruthy();
      expect(mockSocket.emit).toHaveBeenCalledWith('sync_request', {
        userId: mockUser.id,
        lastSyncTimestamp,
        correlationId,
        timestamp: expect.any(String)
      });
    });

    it('should not allow sync request when disconnected', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Socket is not connected
      mockSocket.connected = false;
      
      const correlationId = result.current.requestSync();
      
      expect(correlationId).toBe(null);
      expect(mockSocket.emit).not.toHaveBeenCalledWith('sync_request', expect.any(Object));
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should implement exponential backoff for reconnection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
      
      act(() => {
        errorHandler?.(new Error('Connection failed'));
      });
      
      await waitFor(() => {
        expect(result.current.reconnectionState.isReconnecting).toBe(true);
        expect(result.current.reconnectionState.attempts).toBe(1);
      }, { timeout: 1000 });
      
      // Fast forward time to trigger reconnection
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // Should attempt reconnection
      await waitFor(() => {
        expect(mockIo).toHaveBeenCalledTimes(2); // Initial + retry
      }, { timeout: 1000 });
    });

    it('should stop reconnection after max attempts', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
      
      // Simulate multiple connection failures
      for (let i = 0; i < 11; i++) {
        act(() => {
          errorHandler?.(new Error('Connection failed'));
        });
        
        if (i < 10) {
          act(() => {
            vi.advanceTimersByTime(1000); // Use shorter delay for tests
          });
        }
      }
      
      await waitFor(() => {
        expect(result.current.reconnectionState.attempts).toBe(11);
        expect(result.current.reconnectionState.isReconnecting).toBe(false);
      }, { timeout: 2000 });
      
      // Should show error toast
      expect(toast.error).toHaveBeenCalledWith(
        'Conexão perdida',
        expect.objectContaining({
          description: expect.stringContaining('Não foi possível reconectar')
        })
      );
    });
  });
});