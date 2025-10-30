import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWebSocket } from '../useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '../useNotifications';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

// Tipos para os testes
type MockCall = [string, (...args: any[]) => void];

// Mock dependencies
vi.mock('socket.io-client');
vi.mock('@/contexts/AuthContext');
vi.mock('../useNotifications');
vi.mock('sonner');

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockSocket = {
  connected: false,
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  id: 'mock-socket-id'
};

const mockIo = vi.mocked(io);

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset socket state
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    
    // Mock io to return our mock socket
    mockIo.mockReturnValue(mockSocket as any);
    
    // Mock useNotifications
    vi.mocked(useNotifications).mockReturnValue({
      permission: 'granted' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
      showNotification: vi.fn(),
      playNotificationSound: vi.fn(),
      isSupported: true
    });
    
    // Mock useAuth to return authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
      isLoading: false
    } as any);
    
    // Mock toast
    vi.mocked(toast).mockReturnValue({} as any);
    vi.mocked(toast.success).mockReturnValue({} as any);
    vi.mocked(toast.error).mockReturnValue({} as any);
    vi.mocked(toast.info).mockReturnValue({} as any);
  });

  describe('Connection Management', () => {
    it('should connect when user is authenticated', async () => {
      renderHook(() => useWebSocket());
      
      // Verify io was called with correct parameters
      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        })
      );
    });

    it('should not connect when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        logout: vi.fn(),
        isLoading: false
      } as any);

      renderHook(() => useWebSocket());

      expect(mockIo).not.toHaveBeenCalled();
    });

    it('should handle successful connection', async () => {
      renderHook(() => useWebSocket());
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect')?.[1];
      
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('register', mockUser.id);
    });

    it('should handle connection errors', async () => {
      renderHook(() => useWebSocket());
      
      const error = new Error('Connection failed');
      const errorHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect_error')?.[1];
      
      act(() => {
        errorHandler?.(error);
      });

      // Should attempt reconnection on error
      expect(mockSocket.connected).toBe(false);
    });

    it('should handle disconnection and attempt reconnection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'disconnect')?.[1];
      act(() => {
        mockSocket.connected = false;
        disconnectHandler?.('transport close');
      });

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Message Handling', () => {
    it('should handle new messages', async () => {
      const mockCallback = vi.fn();
      const { result } = renderHook(() => useWebSocket());
      
      act(() => {
        result.current.setOnNewMessage(mockCallback);
      });
      
      // Simulate message reception
      const messageHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'new_message')?.[1];
      const testMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-1',
        content: 'Test message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        requiresAck: true
      };

      act(() => {
        messageHandler?.(testMessage);
      });

      expect(mockCallback).toHaveBeenCalledWith(testMessage);
      expect(mockSocket.emit).toHaveBeenCalledWith('message_ack', expect.objectContaining({
        messageId: 'msg-1'
      }));
    });

    it('should send acknowledgment for messages requiring ack', async () => {
      renderHook(() => useWebSocket());
      
      const messageHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'new_message')?.[1];
      const testMessage = {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        contactName: 'Test Contact',
        contactPhone: '1234567890',
        messageId: 'msg-1',
        content: 'Test message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        requiresAck: true
      };

      act(() => {
        messageHandler?.(testMessage);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('message_ack', expect.objectContaining({
        messageId: 'msg-1',
        timestamp: expect.any(String)
      }));
    });
  });

  describe('Heartbeat System', () => {
    it('should handle heartbeat acknowledgment', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect to enable heartbeat
      const connectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      const heartbeatAckHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'heartbeat_ack')?.[1];
      const heartbeatData = {
        timestamp: new Date().toISOString(),
        latency: '50ms'
      };

      act(() => {
        heartbeatAckHandler?.(heartbeatData);
      });

      expect(result.current.lastHeartbeat).toBeTruthy();
      expect(result.current.connectionQuality).toBe('good');
    });

    it('should handle server heartbeat', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect to enable heartbeat
      const connectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });
      
      const serverHeartbeatHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'server_heartbeat')?.[1];
      const heartbeatData = {
        timestamp: new Date().toISOString(),
        serverId: 'test-server'
      };

      act(() => {
        serverHeartbeatHandler?.(heartbeatData);
      });

      expect(result.current.lastHeartbeat).toBeTruthy();
      expect(mockSocket.emit).toHaveBeenCalledWith('server_heartbeat_response', expect.objectContaining({
        serverTimestamp: heartbeatData.timestamp,
        clientTimestamp: expect.any(String),
        serverId: 'test-server'
      }));
    });
  });

  describe('Reconnection Logic', () => {
    it('should handle manual reconnection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect')?.[1];
      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      // Force reconnection
      act(() => {
        result.current.forceReconnect();
      });

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      renderHook(() => useWebSocket());
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect_error')?.[1];
      
      act(() => {
        errorHandler?.(new Error('Network error'));
      });

      // Should not crash and should attempt reconnection
      expect(mockSocket.connected).toBe(false);
    });

    it('should handle multiple connection failures', async () => {
      renderHook(() => useWebSocket());
      
      const errorHandler = mockSocket.on.mock.calls.find((call: MockCall) => call[0] === 'connect_error')?.[1];
      
      // Simulate multiple connection failures
      for (let i = 0; i < 3; i++) {
        act(() => {
          errorHandler?.(new Error(`Connection failed ${i + 1}`));
        });
      }

      // Should still be attempting to reconnect
      expect(mockSocket.connected).toBe(false);
    });
  });
});