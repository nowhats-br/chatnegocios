import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Search, 
  MoreHorizontal,
  Send,
  Paperclip,
  Smile,
  RefreshCw,
  History,
  Calendar,
  Clock,
  CheckCircle,
  ArrowLeftRight,
  UserPlus,
  Receipt,
  Star,
  ChevronDown,
  ChevronUp,
  Ticket as TicketIcon,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Conversation, Message, MessageType } from '@/types/database';
import { Ticket, TicketStatus, TicketPriority } from '@/types/ticket';
import { dbClient } from '@/lib/dbClient';
import { ticketService } from '@/lib/ticketService';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAutoSync } from '@/hooks/useAutoSync';
import ConnectionStatus from '@/components/ui/ConnectionStatus';

import { cn } from '@/lib/utils';

interface TicketWithDetails extends Ticket {
  conversation?: Conversation;
  lastMessage?: {
    id: string;
    content: string | null;
    created_at: string;
    sender_is_user: boolean;
    message_type: MessageType;
  };
  unreadCount?: number;
}

export default function Atendimentos() {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<TicketStatus>('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showHistoryDetails, setShowHistoryDetails] = useState(false);
  
  const { user } = useAuth();
  const { permission, showNotification, playNotificationSound } = useNotifications();
  const { 
    isConnected,
    connectionQuality,
    lastHeartbeat,
    reconnectionState,
    forceReconnect,
    setOnNewMessage,
    setOnConnectionUpdate
  } = useWebSocket();

  // Sistema de sincronização automática
  const {
    isRunning: isSyncing,
    lastSyncTime,
    error: syncError,
    syncCount
  } = useAutoSync({
    enabled: true,
    syncInterval: 30000, // 30 segundos
    onSyncComplete: (data) => {
      console.log('[AutoSync] Sincronização completa:', data);
      if (data.tickets.length > 0) {
        toast.success(`${data.tickets.length} novo${data.tickets.length > 1 ? 's' : ''} ticket${data.tickets.length > 1 ? 's' : ''} criado${data.tickets.length > 1 ? 's' : ''}!`);
      }
      fetchTickets(); // Recarregar tickets após sincronização
    },
    onSyncError: (error) => {
      console.error('[AutoSync] Erro na sincronização:', error);
      toast.error('Erro na sincronização automática', { description: error });
    },
    onNewTicket: (ticket) => {
      console.log('[AutoSync] Novo ticket criado:', ticket);
      
      // Mostrar notificação de novo ticket
      if (permission === 'granted') {
        showNotification({
          title: `Novo Ticket #${ticket.number}`,
          body: `${ticket.contact?.name || 'Cliente'}: ${ticket.subject}`,
          tag: `ticket-${ticket.id}`,
        });
        playNotificationSound();
      }
      
      // Adicionar ticket à lista
      setTickets(prev => [ticket as TicketWithDetails, ...prev]);
    }
  });

  // Função para buscar tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    
    try {
      const { tickets: ticketData } = await ticketService.getTickets({
        status: activeFilter ? [activeFilter] : undefined,
        search: searchTerm || undefined
      });
      
      // Enriquecer tickets com informações de mensagens
      const ticketsWithDetails = await Promise.all(
        ticketData.map(async (ticket) => {
          try {
            const messages = await dbClient.messages.listByConversation(ticket.conversation_id);
            const lastMessage = messages[messages.length - 1];
            const unreadCount = messages.filter(m => !m.sender_is_user && !m.internal_message).length;
            
            return {
              ...ticket,
              lastMessage: lastMessage || undefined,
              unreadCount
            };
          } catch {
            return { ...ticket, unreadCount: 0 };
          }
        })
      );
      
      setTickets(ticketsWithDetails as TicketWithDetails[]);
      
      console.log('[Tickets] Tickets carregados:', {
        total: ticketsWithDetails.length,
        filter: activeFilter,
        search: searchTerm
      });
      
    } catch (error: any) {
      console.error('[Tickets] Erro ao buscar tickets:', error);
      toast.error('Erro ao buscar tickets', { 
        description: error.message,
        action: {
          label: 'Tentar novamente',
          onClick: () => fetchTickets()
        }
      });
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchTerm]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const data = await dbClient.messages.listByConversation(conversationId);
      setMessages(data);
    } catch (error: any) {
      toast.error('Erro ao buscar mensagens', { description: error.message });
    }
  }, []);

  // Inicialização
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Função para atualizar status do ticket
  const updateTicketStatus = useCallback(async (ticketId: string, newStatus: TicketStatus) => {
    try {
      await ticketService.updateTicketStatus(ticketId, newStatus);
      
      // Atualizar ticket na lista
      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: newStatus, updated_at: new Date().toISOString() }
          : ticket
      ));
      
      // Atualizar ticket ativo se for o mesmo
      if (activeTicket?.id === ticketId) {
        setActiveTicket(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      toast.success(`Ticket ${newStatus === 'resolved' ? 'resolvido' : 'atualizado'} com sucesso!`);
      
    } catch (error: any) {
      toast.error('Erro ao atualizar ticket', { description: error.message });
    }
  }, [activeTicket]);

  // Enhanced WebSocket callbacks with ticket integration
  useEffect(() => {
    // Callback para novas mensagens via WebSocket - ATUALIZA TICKETS EM TEMPO REAL
    setOnNewMessage((message) => {
      console.log('[WebSocket] Nova mensagem recebida - Atualizando tickets:', message);
      
      // Atualizar tickets existentes ou criar novo se necessário
      setTickets(prev => {
        const updatedTickets = [...prev];
        const existingIndex = updatedTickets.findIndex(t => t.conversation_id === message.conversationId);
        
        if (existingIndex >= 0) {
          // Atualizar ticket existente
          const existingTicket = updatedTickets[existingIndex];
          updatedTickets[existingIndex] = {
            ...existingTicket,
            updated_at: message.timestamp,
            lastMessage: {
              id: message.messageId,
              content: message.content,
              created_at: message.timestamp,
              sender_is_user: false,
              message_type: (message.messageType as MessageType) || 'text'
            },
            unreadCount: (existingTicket.unreadCount || 0) + 1
          };
          
          // Mover para o topo
          const updatedTicket = updatedTickets.splice(existingIndex, 1)[0];
          updatedTickets.unshift(updatedTicket);
          
          // Atualizar primeira resposta se necessário
          if (!existingTicket.first_response_at && !message.sender_is_user) {
            ticketService.updateFirstResponseTime(existingTicket.id);
          }
        } else if (message.isNewConversation) {
          // Nova conversa detectada - o sistema de auto-sync criará o ticket
          console.log('[WebSocket] Nova conversa detectada, aguardando criação de ticket...');
        }
        
        return updatedTickets;
      });
      
      // Se o ticket ativo é o que recebeu a mensagem, atualizar as mensagens também
      if (activeTicket?.conversation_id === message.conversationId) {
        fetchMessages(message.conversationId);
      }
      
      // Mostrar notificação
      if (permission === 'granted') {
        showNotification({
          title: 'Nova Mensagem - Ticket',
          body: `${message.contactName}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
          tag: `message-${message.conversationId}`,
        });
        playNotificationSound();
      }
      
      console.log(`[WebSocket] Ticket atualizado para contato: ${message.contactName} (${message.contactPhone})`);
    });

    // Callback para atualizações de conexão - TRIGGER AUTO-SYNC
    setOnConnectionUpdate((update) => {
      console.log('[WebSocket] Atualização de conexão:', update);
      
      if (update.status === 'CONNECTED') {
        console.log('[WebSocket] WhatsApp conectado - Auto-sync ativo');
        // O auto-sync já está rodando, não precisa fazer nada manual
      }
    });
  }, [setOnNewMessage, setOnConnectionUpdate, fetchMessages, activeTicket, permission, showNotification, playNotificationSound]);

  const handleSelectTicket = (ticket: TicketWithDetails) => {
    setActiveTicket(ticket);
    fetchMessages(ticket.conversation_id);
    
    // Marcar ticket como aberto se estava como novo
    if (ticket.status === 'new') {
      updateTicketStatus(ticket.id, 'open');
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeTicket || !user) return;

    try {
      await dbClient.messages.create({
        conversation_id: activeTicket.conversation_id,
        content: messageText,
        sender_is_user: true,
        message_type: 'text',
      });

      setMessageText('');
      fetchMessages(activeTicket.conversation_id);
      
      // Atualizar primeira resposta se necessário
      if (!activeTicket.first_response_at) {
        await ticketService.updateFirstResponseTime(activeTicket.id);
      }
      
      // Atualizar status para 'open' se estava como 'new'
      if (activeTicket.status === 'new') {
        updateTicketStatus(activeTicket.id, 'open');
      }
      
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem', { description: error.message });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesFilter = !activeFilter || ticket.status === activeFilter;
    const matchesSearch = !searchTerm || 
      ticket.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.contact?.phone_number?.includes(searchTerm) ||
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.number?.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  // Função para obter cor da prioridade
  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300';
      case 'normal': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
      case 'low': return 'text-gray-600 bg-gray-100 dark:bg-gray-900/50 dark:text-gray-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'new': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300';
      case 'open': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
      case 'pending': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'resolved': return 'text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-300';
      case 'closed': return 'text-gray-600 bg-gray-100 dark:bg-gray-900/50 dark:text-gray-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  const formatTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return messageDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900">
      {/* Sidebar de navegação */}
      <aside className="flex w-20 flex-col items-center border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 py-4">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary rounded-full size-12 flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
        </div>
      </aside>

      {/* Lista de conversas */}
      <nav className="flex w-full max-w-sm flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sistema de Tickets</h1>
            
            {/* Connection Status and Auto-Sync Status */}
            <div className="flex items-center gap-3">
              {/* Auto-Sync Status */}
              <div className="flex items-center gap-2">
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isSyncing ? 'Sincronizando...' : `Sync: ${syncCount}`}
                </span>
              </div>
              
              {/* Connection Status Component */}
              <ConnectionStatus
                isConnected={isConnected}
                connectionQuality={connectionQuality}
                lastHeartbeat={lastHeartbeat}
                reconnectionState={reconnectionState}
                onForceReconnect={forceReconnect}
                showDetails={false}
              />
            </div>
          </div>
          
          {/* Campo de busca */}
          <div className="mt-4">
            <div className="flex w-full items-stretch rounded-lg h-11">
              <div className="text-gray-500 dark:text-gray-400 flex bg-gray-100 dark:bg-gray-800 items-center justify-center pl-3 rounded-l-lg border-y border-l border-gray-200 dark:border-gray-700">
                <Search className="w-4 h-4" />
              </div>
              <input 
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-1 focus:ring-primary border-y border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 h-full placeholder:text-gray-500 dark:placeholder:text-gray-400 px-2 text-sm font-normal"
                placeholder="Buscar por nome ou número"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filtros de Status */}
          <div className="flex gap-2 pt-4 flex-wrap">
            <button 
              onClick={() => setActiveFilter('new')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'new' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <TicketIcon className="w-3 h-3" />
              <p className="text-sm font-medium leading-normal">Novos</p>
            </button>
            <button 
              onClick={() => setActiveFilter('open')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'open' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <p className="text-sm font-medium leading-normal">Abertos</p>
            </button>
            <button 
              onClick={() => setActiveFilter('pending')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <Clock className="w-3 h-3" />
              <p className="text-sm font-medium leading-normal">Pendentes</p>
            </button>
            <button 
              onClick={() => setActiveFilter('resolved')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'resolved' ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <CheckCircle className="w-3 h-3" />
              <p className="text-sm font-medium leading-normal">Resolvidos</p>
            </button>
          </div>
        </div>

        {/* Lista de tickets */}
        <div className="flex-1 overflow-y-auto relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {syncError ? 'Tentando reconectar...' : 'Carregando tickets...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Aguarde enquanto buscamos os tickets mais recentes
              </p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <TicketIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {activeFilter === 'new' ? 'Nenhum ticket novo' : `Nenhum ticket ${activeFilter}`}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mb-4">
                {activeFilter === 'new' 
                  ? 'Novos tickets aparecerão aqui automaticamente quando chegarem mensagens no WhatsApp'
                  : `Não há tickets com status "${activeFilter}" no momento`
                }
              </p>
              
              {/* Status de sincronização automática */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sincronização automática ativa...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Sistema sincronizado ({syncCount} sync)</span>
                    </>
                  )}
                </div>
                
                <ConnectionStatus
                  isConnected={isConnected}
                  connectionQuality={connectionQuality}
                  lastHeartbeat={lastHeartbeat}
                  reconnectionState={reconnectionState}
                  onForceReconnect={forceReconnect}
                  showDetails={true}
                  className="justify-center"
                />
                
                {lastSyncTime && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Última sincronização: {lastSyncTime.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isNewTicket = ticket.status === 'new' || (ticket.unreadCount && ticket.unreadCount > 0);
              const isActiveTicket = activeTicket?.id === ticket.id;
              
              return (
                <div
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={cn(
                    "flex gap-4 px-4 py-3 justify-between cursor-pointer transition-all duration-200 border-l-4",
                    isActiveTicket 
                      ? "bg-primary/10 dark:bg-primary/20 border-primary" 
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent",
                    isNewTicket && "bg-purple-50/50 dark:bg-purple-900/10"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      {/* Avatar do contato */}
                      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full size-12 flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                        {ticket.contact?.name?.charAt(0)?.toUpperCase() || 
                         ticket.contact?.phone_number?.slice(-2) || 'U'}
                      </div>
                      {/* Indicador de prioridade */}
                      {ticket.priority === 'urgent' && (
                        <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800">
                          <AlertCircle className="w-3 h-3 text-white m-0.5" />
                        </span>
                      )}
                      {ticket.priority === 'high' && (
                        <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-orange-500 ring-2 ring-white dark:ring-gray-800">
                          <TrendingUp className="w-3 h-3 text-white m-0.5" />
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-1 flex-col justify-center min-w-0">
                      {/* Cabeçalho do ticket */}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-gray-900 dark:text-white text-base font-medium leading-normal truncate">
                          {ticket.contact?.name || `+${ticket.contact?.phone_number}` || 'Cliente'}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          #{ticket.number}
                        </span>
                        {isNewTicket && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                            Novo
                          </span>
                        )}
                      </div>
                      
                      {/* Assunto do ticket */}
                      <p className="text-gray-800 dark:text-gray-200 text-sm font-medium leading-normal truncate mb-1">
                        {ticket.subject}
                      </p>
                      
                      {/* Última mensagem */}
                      <p className="text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal truncate">
                        {ticket.lastMessage?.sender_is_user ? '✓ ' : ''}
                        {ticket.lastMessage?.content || 'Aguardando primeira mensagem...'}
                      </p>
                      
                      {/* Tags do ticket */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getPriorityColor(ticket.priority))}>
                          {ticket.priority === 'urgent' ? 'Urgente' : 
                           ticket.priority === 'high' ? 'Alta' :
                           ticket.priority === 'normal' ? 'Normal' : 'Baixa'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {ticket.category === 'support' ? 'Suporte' :
                           ticket.category === 'sales' ? 'Vendas' :
                           ticket.category === 'billing' ? 'Cobrança' :
                           ticket.category === 'technical' ? 'Técnico' : 'Outros'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      {ticket.lastMessage?.created_at ? formatTime(ticket.lastMessage.created_at) : formatTime(ticket.created_at)}
                    </p>
                    {ticket.unreadCount && ticket.unreadCount > 0 && (
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold animate-pulse">
                        {ticket.unreadCount}
                      </div>
                    )}
                    {/* Status do ticket */}
                    <div className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(ticket.status))}>
                      {ticket.status === 'new' ? 'Novo' :
                       ticket.status === 'open' ? 'Aberto' :
                       ticket.status === 'pending' ? 'Pendente' :
                       ticket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </nav>

      {/* Área principal do chat */}
      <main className="flex flex-1 flex-col bg-gray-100/50 dark:bg-gray-900/20">
        {activeTicket ? (
          <>
            {/* Header do ticket */}
            <header className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-6 py-3">
              <div className="bg-primary rounded-full size-12 flex items-center justify-center text-white font-semibold">
                {activeTicket.contact?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activeTicket.contact?.name || 'Cliente'}
                  </h2>
                  <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                    #{activeTicket.number}
                  </span>
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium", getStatusColor(activeTicket.status))}>
                    {activeTicket.status === 'new' ? 'Novo' :
                     activeTicket.status === 'open' ? 'Aberto' :
                     activeTicket.status === 'pending' ? 'Pendente' :
                     activeTicket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
                  </span>
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium", getPriorityColor(activeTicket.priority))}>
                    {activeTicket.priority === 'urgent' ? 'Urgente' : 
                     activeTicket.priority === 'high' ? 'Alta' :
                     activeTicket.priority === 'normal' ? 'Normal' : 'Baixa'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {activeTicket.subject}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <Search className="w-5 h-5" />
                </button>
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Barra de ações do ticket */}
            <div className="flex items-center justify-around gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-2 text-xs text-center">
              {activeTicket.status === 'resolved' || activeTicket.status === 'closed' ? (
                <button 
                  onClick={() => updateTicketStatus(activeTicket.id, 'open')}
                  className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24"
                >
                  <History className="w-4 h-4" />
                  <span>Reabrir Ticket</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => updateTicketStatus(activeTicket.id, 'pending')}
                    className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors p-1 rounded-md w-24"
                    disabled={activeTicket.status === 'pending'}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Pendente</span>
                  </button>
                  <button 
                    onClick={() => updateTicketStatus(activeTicket.id, 'resolved')}
                    className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1 rounded-md w-24"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Resolver</span>
                  </button>
                </>
              )}
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <Calendar className="w-4 h-4" />
                <span>Agendamento</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transferir</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <UserPlus className="w-4 h-4" />
                <span>Atribuir</span>
              </button>
            </div>

            {/* Área de mensagens */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-center my-4">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1">
                  Hoje
                </span>
              </div>
              
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.sender_is_user ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-lg rounded-xl p-3 shadow-sm",
                    message.sender_is_user 
                      ? "rounded-br-none bg-green-100 dark:bg-green-900/50" 
                      : "rounded-tl-none bg-white dark:bg-gray-800"
                  )}>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{message.content}</p>
                    <div className={cn("flex items-center gap-1 mt-1", message.sender_is_user ? "justify-end" : "justify-start")}>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatTime(message.created_at)}
                      </span>
                      {message.sender_is_user && (
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Campo de envio de mensagem */}
            <footer className="bg-white dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2">
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-lg h-10 px-4 focus:ring-2 focus:ring-primary text-sm text-gray-900 dark:text-white placeholder:text-gray-500"
                  placeholder="Digite uma mensagem..."
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage}
                  className="flex items-center justify-center size-10 rounded-full bg-primary text-white hover:bg-primary/90"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/20">
            <div className="text-center max-w-md">
              <div className="w-32 h-32 bg-gradient-to-br from-primary/10 to-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TicketIcon className="w-16 h-16 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Sistema de Tickets
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Selecione um ticket da lista para iniciar o atendimento
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Sistema Automático:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• ✅ Tickets criados automaticamente via WhatsApp</li>
                  <li>• ⚡ Sincronização automática a cada 30 segundos</li>
                  <li>• 🎯 Prioridade e categoria detectadas automaticamente</li>
                  <li>• 📊 Métricas de SLA e tempo de resposta</li>
                  <li>• 🔄 Status: Novo → Aberto → Pendente → Resolvido</li>
                </ul>
                
                {/* Status da sincronização */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-primary">Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">Sistema ativo ({syncCount} sync)</span>
                      </>
                    )}
                  </div>
                  {lastSyncTime && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Última sincronização: {lastSyncTime.toLocaleTimeString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Painel lateral de informações do ticket */}
      {activeTicket && (
        <aside className="w-full max-w-sm flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 flex">
          {/* Informações do ticket */}
          <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700">
            <div className="mx-auto bg-primary rounded-full size-24 mb-4 flex items-center justify-center text-white text-2xl font-bold">
              {activeTicket.contact?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeTicket.contact?.name || 'Cliente'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTicket.contact?.phone_number || 'Sem telefone'}
            </p>
            <p className="text-sm font-mono text-gray-600 dark:text-gray-300 mt-1">
              Ticket #{activeTicket.number}
            </p>
            
            {/* Informações do ticket */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-center gap-2">
                <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", getStatusColor(activeTicket.status))}>
                  {activeTicket.status === 'new' ? 'Novo' :
                   activeTicket.status === 'open' ? 'Aberto' :
                   activeTicket.status === 'pending' ? 'Pendente' :
                   activeTicket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
                </span>
                <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", getPriorityColor(activeTicket.priority))}>
                  {activeTicket.priority === 'urgent' ? 'Urgente' : 
                   activeTicket.priority === 'high' ? 'Alta' :
                   activeTicket.priority === 'normal' ? 'Normal' : 'Baixa'}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>Categoria: {activeTicket.category === 'support' ? 'Suporte' :
                              activeTicket.category === 'sales' ? 'Vendas' :
                              activeTicket.category === 'billing' ? 'Cobrança' :
                              activeTicket.category === 'technical' ? 'Técnico' : 'Outros'}</p>
                <p>Criado: {formatTime(activeTicket.created_at)}</p>
                {activeTicket.first_response_at && (
                  <p>Primeira resposta: {formatTime(activeTicket.first_response_at)}</p>
                )}
                {activeTicket.resolved_at && (
                  <p>Resolvido: {formatTime(activeTicket.resolved_at)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Notas internas e ações */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div>
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Notas Internas</h4>
              <textarea 
                className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-2 focus:ring-primary text-sm text-gray-900 dark:text-white placeholder:text-gray-500"
                placeholder="Adicione uma nota sobre o cliente..."
                rows={4}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <button className="w-full flex items-center justify-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300">
                <UserPlus className="w-4 h-4" />
                <span>Anexar cliente a uma carteira</span>
              </button>
              <button className="w-full flex items-center justify-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300">
                <Receipt className="w-4 h-4" />
                <span>Criar protocolo manual</span>
              </button>
              <button className="w-full flex items-center justify-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300">
                <Star className="w-4 h-4" />
                <span>Enviar avaliação de atendimento</span>
              </button>
            </div>

            {/* Histórico de atendimentos */}
            <div>
              <button 
                onClick={() => setShowHistoryDetails(!showHistoryDetails)}
                className="cursor-pointer flex justify-between items-center text-sm font-semibold text-gray-600 dark:text-gray-300 w-full"
              >
                Histórico de Atendimentos
                {showHistoryDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistoryDetails && (
                <div className="mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4 text-sm">
                  <div className="text-gray-700 dark:text-gray-300">
                    <p><span className="font-medium">25/07/2024:</span> Dúvida sobre entrega.</p>
                    <p className="text-xs text-gray-500">Finalizado por: Carlos</p>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    <p><span className="font-medium">12/06/2024:</span> Solicitação de troca.</p>
                    <p className="text-xs text-gray-500">Finalizado por: Ana</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}