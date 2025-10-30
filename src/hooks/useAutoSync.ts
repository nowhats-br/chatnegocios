import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dbClient } from '@/lib/dbClient';
import { ticketService } from '@/lib/ticketService';
import { Conversation } from '@/types/database';
import { Ticket } from '@/types/ticket';

// Hook para sincronização automática de tickets

interface AutoSyncOptions {
  enabled?: boolean;
  syncInterval?: number; // em milissegundos
  onSyncComplete?: (data: { conversations: Conversation[]; tickets: Ticket[] }) => void;
  onSyncError?: (error: string) => void;
  onNewTicket?: (ticket: Ticket) => void;
}

interface SyncState {
  isRunning: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  syncCount: number;
}

export function useAutoSync(options: AutoSyncOptions = {}) {
  const {
    enabled = true,
    syncInterval = 30000, // 30 segundos por padrão
    onSyncComplete,
    onSyncError,
    onNewTicket
  } = options;

  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>({
    isRunning: false,
    lastSyncTime: null,
    error: null,
    syncCount: 0
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimestampRef = useRef<string | null>(null);
  const isInitialSyncRef = useRef(true);

  // Função principal de sincronização
  const performSync = useCallback(async (isManual = false) => {
    if (!user?.id || !enabled) return;

    setSyncState(prev => ({ ...prev, isRunning: true, error: null }));

    try {
      console.log('[AutoSync] Iniciando sincronização automática...', {
        isManual,
        lastSyncTimestamp: lastSyncTimestampRef.current,
        isInitial: isInitialSyncRef.current
      });

      // Sincronizar conversas
      const syncResult = await dbClient.conversations.sync(
        lastSyncTimestampRef.current || undefined,
        50
      );

      console.log('[AutoSync] Conversas sincronizadas:', {
        found: syncResult.totalFound,
        hasMore: syncResult.hasMore,
        syncTimestamp: syncResult.syncTimestamp
      });

      // Processar novas conversas e criar tickets automaticamente
      const newTickets: Ticket[] = [];
      
      for (const conversation of syncResult.conversations) {
        try {
          // Verificar se já existe um ticket para esta conversa
          const existingTicket = await ticketService.getTicketById(conversation.id);
          
          if (!existingTicket) {
            // Buscar a primeira mensagem da conversa para criar o ticket
            const messages = await dbClient.messages.listByConversation(conversation.id);
            const firstMessage = messages.find(m => !m.sender_is_user);
            
            // Criar ticket automaticamente
            const newTicket = await ticketService.createTicketFromConversation(
              conversation,
              firstMessage
            );
            
            newTickets.push(newTicket);
            
            console.log('[AutoSync] Novo ticket criado automaticamente:', {
              ticketNumber: newTicket.number,
              conversationId: conversation.id,
              contactName: conversation.contacts?.name,
              priority: newTicket.priority,
              category: newTicket.category
            });

            // Notificar sobre novo ticket
            if (onNewTicket) {
              onNewTicket(newTicket);
            }
          }
        } catch (error) {
          console.error('[AutoSync] Erro ao processar conversa para ticket:', error);
        }
      }

      // Atualizar timestamp da última sincronização
      lastSyncTimestampRef.current = syncResult.syncTimestamp;
      isInitialSyncRef.current = false;

      const now = new Date();
      setSyncState(prev => ({
        ...prev,
        isRunning: false,
        lastSyncTime: now,
        error: null,
        syncCount: prev.syncCount + 1
      }));

      // Callback de sucesso
      if (onSyncComplete) {
        onSyncComplete({
          conversations: syncResult.conversations,
          tickets: newTickets
        });
      }

      console.log('[AutoSync] Sincronização concluída com sucesso:', {
        conversationsFound: syncResult.totalFound,
        newTicketsCreated: newTickets.length,
        syncCount: syncState.syncCount + 1
      });

    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido na sincronização';
      
      console.error('[AutoSync] Erro na sincronização:', error);
      
      setSyncState(prev => ({
        ...prev,
        isRunning: false,
        error: errorMessage
      }));

      // Callback de erro
      if (onSyncError) {
        onSyncError(errorMessage);
      }
    }
  }, [user?.id, enabled, onSyncComplete, onSyncError, onNewTicket, syncState.syncCount]);

  // Função para sincronização manual
  const triggerManualSync = useCallback(() => {
    console.log('[AutoSync] Sincronização manual solicitada');
    performSync(true);
  }, [performSync]);

  // Função para resetar o estado de sincronização
  const resetSync = useCallback(() => {
    lastSyncTimestampRef.current = null;
    isInitialSyncRef.current = true;
    setSyncState({
      isRunning: false,
      lastSyncTime: null,
      error: null,
      syncCount: 0
    });
    console.log('[AutoSync] Estado de sincronização resetado');
  }, []);

  // Configurar intervalo de sincronização automática
  useEffect(() => {
    if (!enabled || !user?.id) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Sincronização inicial
    if (isInitialSyncRef.current) {
      console.log('[AutoSync] Executando sincronização inicial...');
      performSync(false);
    }

    // Configurar intervalo de sincronização
    syncIntervalRef.current = setInterval(() => {
      console.log('[AutoSync] Executando sincronização periódica...');
      performSync(false);
    }, syncInterval);

    console.log('[AutoSync] Sincronização automática configurada:', {
      interval: `${syncInterval / 1000}s`,
      enabled
    });

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [enabled, user?.id, syncInterval, performSync]);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return {
    // Estado da sincronização
    isRunning: syncState.isRunning,
    lastSyncTime: syncState.lastSyncTime,
    error: syncState.error,
    syncCount: syncState.syncCount,
    
    // Controles
    triggerManualSync,
    resetSync,
    
    // Configurações
    enabled,
    syncInterval
  };
}