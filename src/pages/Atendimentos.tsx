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
  ChevronUp
} from 'lucide-react';
import { Conversation, ConversationStatus, Message } from '@/types/database';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useWebSocket } from '@/hooks/useWebSocket';

import { cn } from '@/lib/utils';

interface ConversationWithDetails extends Conversation {
  lastMessage?: Message;
  unreadCount?: number;
  contact?: {
    id: string;
    name: string;
    phone_number: string;
  };
}

export default function Atendimentos() {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showHistoryDetails, setShowHistoryDetails] = useState(false);
  
  const { user } = useAuth();
  const { permission, showNotification, playNotificationSound } = useNotifications();
  const { 
    setOnNewMessage,
    setOnConnectionUpdate 
  } = useWebSocket();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.conversations.listWithContact();
      
      const conversationsWithDetails = await Promise.all(
        data.map(async (conv) => {
          try {
            const messages = await dbClient.messages.listByConversation(conv.id);
            const lastMessage = messages[messages.length - 1];
            const unreadCount = messages.filter(m => !m.sender_is_user && !m.internal_message).length;
            
            return {
              ...conv,
              lastMessage: lastMessage || undefined,
              unreadCount
            };
          } catch {
            return { ...conv, unreadCount: 0 };
          }
        })
      );
      
      setConversations(conversationsWithDetails);
    } catch (error: any) {
      toast.error('Erro ao buscar conversas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchConversations();
  }, [fetchConversations]);

  // Configurar callbacks do WebSocket para criação automática de tickets
  useEffect(() => {
    // Callback para novas mensagens via WebSocket - CRIA TICKETS AUTOMATICAMENTE
    setOnNewMessage((message) => {
      console.log('[Ticket System] Nova mensagem recebida - Criando/Atualizando ticket:', message);
      
      // Atualizar a lista de tickets (conversas) imediatamente
      fetchConversations();
      
      // Se a conversa ativa é a que recebeu a mensagem, atualizar as mensagens também
      if (activeConversation?.id === message.conversationId) {
        fetchMessages(message.conversationId);
      }
      
      // Mostrar notificação do novo ticket/mensagem
      if (permission === 'granted') {
        showNotification({
          title: 'Novo Ticket - WhatsApp',
          body: `${message.contactName}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
          tag: `ticket-${message.conversationId}`,
        });
        playNotificationSound();
      }
      
      // Log para debug do sistema de tickets
      console.log(`[Ticket System] Ticket atualizado para contato: ${message.contactName} (${message.contactPhone})`);
    });

    // Callback para atualizações de conexão - SINCRONIZA TICKETS QUANDO CONECTA
    setOnConnectionUpdate((update) => {
      console.log('[Ticket System] Atualização de conexão:', update);
      
      if (update.status === 'CONNECTED') {
        console.log('[Ticket System] WhatsApp conectado - Sincronizando tickets automaticamente...');
        // Aguardar um pouco para garantir que o webhook foi configurado
        setTimeout(() => {
          fetchConversations();
        }, 2000);
      }
    });
  }, [setOnNewMessage, setOnConnectionUpdate, fetchConversations, fetchMessages, activeConversation, permission, showNotification, playNotificationSound]);

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setActiveConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeConversation || !user) return;

    try {
      await dbClient.messages.create({
        conversation_id: activeConversation.id,
        content: messageText,
        sender_is_user: true,
        message_type: 'text',
      });

      setMessageText('');
      fetchMessages(activeConversation.id);
      fetchConversations();
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem', { description: error.message });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesFilter = conv.status === activeFilter;
    const matchesSearch = !searchTerm || 
      conv.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contact?.phone_number?.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Caixa de Entrada</h1>
          
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

          {/* Filtros */}
          <div className="flex gap-2 pt-4">
            <button 
              onClick={() => setActiveFilter('pending')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'pending' ? "bg-primary/20 text-primary" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <p className="text-sm font-medium leading-normal">Ativos</p>
            </button>
            <button 
              onClick={() => setActiveFilter('pending')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'pending' ? "bg-primary/20 text-primary" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <p className="text-sm font-medium leading-normal">Aguardando</p>
            </button>
            <button 
              onClick={() => setActiveFilter('resolved')}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center justify-center gap-x-2 rounded-full pl-3 pr-3",
                activeFilter === 'resolved' ? "bg-primary/20 text-primary" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              )}
            >
              <p className="text-sm font-medium leading-normal">Finalizados</p>
            </button>
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Aguardando Tickets
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
                Os tickets aparecerão aqui automaticamente quando chegarem mensagens no WhatsApp
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Sistema conectado via WebSocket</span>
              </div>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              // Determinar se é um ticket novo (não lido)
              const isNewTicket = conversation.unreadCount && conversation.unreadCount > 0;
              const isActiveTicket = activeConversation?.id === conversation.id;
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    "flex gap-4 px-4 py-3 justify-between cursor-pointer transition-all duration-200",
                    isActiveTicket 
                      ? "bg-primary/10 dark:bg-primary/20 border-l-4 border-primary" 
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    isNewTicket && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      {/* Avatar do contato - estilo WhatsApp Web */}
                      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full size-12 flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                        {conversation.contact?.name?.charAt(0)?.toUpperCase() || 
                         conversation.contact?.phone_number?.slice(-2) || 'U'}
                      </div>
                      {/* Indicador de status online */}
                      <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800"></span>
                    </div>
                    
                    <div className="flex flex-1 flex-col justify-center min-w-0">
                      {/* Nome do contato */}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-gray-900 dark:text-white text-base font-medium leading-normal truncate">
                          {conversation.contact?.name || `+${conversation.contact?.phone_number}` || 'Usuário Desconhecido'}
                        </p>
                        {isNewTicket && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                            Novo
                          </span>
                        )}
                      </div>
                      
                      {/* Última mensagem */}
                      <p className="text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal truncate">
                        {conversation.lastMessage?.sender_is_user ? '✓ ' : ''}
                        {conversation.lastMessage?.content || 'Ticket criado - Aguardando primeira mensagem'}
                      </p>
                      
                      {/* Informações do ticket */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          📱 {conversation.contact?.phone_number || 'Sem número'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          • Ticket #{conversation.id.slice(-6)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      {conversation.lastMessage?.created_at ? formatTime(conversation.lastMessage.created_at) : 'Agora'}
                    </p>
                    {isNewTicket && (
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold animate-pulse">
                        {conversation.unreadCount}
                      </div>
                    )}
                    {/* Status do ticket */}
                    <div className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      conversation.status === 'pending' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
                      conversation.status === 'resolved' && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                    )}>
                      {conversation.status === 'pending' ? 'Pendente' : 'Resolvido'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          )}
        </div>
      </nav>

      {/* Área principal do chat */}
      <main className="flex flex-1 flex-col bg-gray-100/50 dark:bg-gray-900/20">
        {activeConversation ? (
          <>
            {/* Header do chat */}
            <header className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-6 py-3">
              <div className="bg-primary rounded-full size-12 flex items-center justify-center text-white font-semibold">
                {activeConversation.contact?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {activeConversation.contact?.name || 'Usuário'}
                </h2>
                <p className="text-sm text-green-600 dark:text-green-400">Online</p>
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

            {/* Barra de ações */}
            <div className="flex items-center justify-around gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-2 text-xs text-center">
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <History className="w-4 h-4" />
                <span>Reabrir Ticket</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <Calendar className="w-4 h-4" />
                <span>Agendamento</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <Clock className="w-4 h-4" />
                <span>Mover p/ Pendente</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <CheckCircle className="w-4 h-4" />
                <span>Resolver Conversa</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors p-1 rounded-md w-24">
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transferir Conversa</span>
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
                <RefreshCw className="w-16 h-16 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Sistema de Tickets
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Selecione um ticket da lista para iniciar o atendimento
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Como funciona:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• Tickets são criados automaticamente via WhatsApp</li>
                  <li>• Mensagens chegam em tempo real via WebSocket</li>
                  <li>• Cada conversa é um ticket independente</li>
                  <li>• Status: Pendente → Em Atendimento → Resolvido</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Painel lateral de informações do cliente */}
      {activeConversation && (
        <aside className="w-full max-w-sm flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 flex">
          {/* Informações do cliente */}
          <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700">
            <div className="mx-auto bg-primary rounded-full size-24 mb-4 flex items-center justify-center text-white text-2xl font-bold">
              {activeConversation.contact?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeConversation.contact?.name || 'Usuário'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeConversation.contact?.phone_number || 'Sem telefone'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/50 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-300/20">
                VIP
              </span>
              <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/50 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20 dark:ring-green-300/20">
                Cliente Novo
              </span>
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