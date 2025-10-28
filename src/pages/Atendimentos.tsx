import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  RotateCcw, 
  Calendar, 
  MoreHorizontal,
  ArrowRight,
  User,
  Phone,
  UserPlus,
  FileText,
  Star,
  ChevronDown,
  Send,
  Paperclip,
  Smile,
  RefreshCw,
  Bell,
  BellOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Conversation, ConversationStatus, Message } from '@/types/database';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ConversationWithDetails extends Conversation {
  lastMessage?: Message;
  unreadCount?: number;
}

export default function Atendimentos() {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const { user } = useAuth();
  const { permission, requestPermission, showNotification, playNotificationSound } = useNotifications();
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);

  // Sincronizar conversas do WhatsApp
  const syncWhatsAppChats = useCallback(async () => {
    setSyncing(true);
    try {
      // Buscar conexões ativas do usuário
      const connections = await dbClient.connections.list();
      const activeConnections = connections.filter(c => c.status === 'CONNECTED');
      
      if (activeConnections.length === 0) {
        toast.warning('Nenhuma conexão ativa encontrada', { 
          description: 'Configure uma conexão do WhatsApp primeiro' 
        });
        return;
      }

      // Sincronizar chats para cada conexão ativa
      for (const connection of activeConnections) {
        try {
          await dbClient.evolution.syncChats({
            connection_id: connection.id,
            instance_name: connection.instance_name,
            limit: 20
          });
        } catch (error: any) {
          console.error(`Erro ao sincronizar ${connection.instance_name}:`, error);
        }
      }
      
      toast.success('Conversas sincronizadas com sucesso!');
      // Recarregar conversas após sincronização
      await fetchConversations();
    } catch (error: any) {
      toast.error('Erro ao sincronizar conversas', { description: error.message });
    } finally {
      setSyncing(false);
    }
  }, []);

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

  // Inicialização e sincronização automática
  useEffect(() => {
    const initializeData = async () => {
      await fetchConversations();
      // Sincronizar automaticamente na inicialização
      await syncWhatsAppChats();
    };
    
    initializeData();
    
    // Auto-sync a cada 5 minutos
    const syncInterval = setInterval(() => {
      syncWhatsAppChats();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(syncInterval);
  }, [fetchConversations, syncWhatsAppChats]);

  // Configurar tempo real do Supabase
  useEffect(() => {
    if (!user) return;

    // Limpar canais existentes
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
      messagesChannelRef.current = null;
    }

    // Canal para conversas
    const conversationsChannel = supabase.channel(`conversations-${user.id}`);
    
    conversationsChannel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'conversations', 
        filter: `user_id=eq.${user.id}` 
      }, (payload: any) => {
        console.log('Conversa atualizada:', payload);
        fetchConversations();
      })
      .subscribe((status: string, err: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao canal de conversas em tempo real!');
          setIsRealtimeConnected(true);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal de conversas:', err);
          setIsRealtimeConnected(false);
          toast.error("Erro na conexão em tempo real", { description: err?.message });
        }
      });

    // Canal para mensagens
    const messagesChannel = supabase.channel(`messages-${user.id}`);
    
    messagesChannel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `user_id=eq.${user.id}` 
      }, (payload: any) => {
        const newMessage = payload.new as Message;
        console.log('Nova mensagem recebida:', newMessage);
        
        // Atualizar lista de conversas (mover para o topo)
        setConversations(prev => {
          const convIndex = prev.findIndex(c => c.id === newMessage.conversation_id);
          if (convIndex > -1) {
            const updatedConv = { ...prev[convIndex], updated_at: new Date().toISOString() };
            const newList = [...prev];
            newList.splice(convIndex, 1);
            return [updatedConv, ...newList];
          }
          return prev;
        });

        // Atualizar contador de não lidas se não for mensagem do usuário
        if (!newMessage.sender_is_user && activeConversation?.id !== newMessage.conversation_id) {
          setUnreadCounts(prev => ({
            ...prev,
            [newMessage.conversation_id]: (prev[newMessage.conversation_id] || 0) + 1
          }));
          
          // Mostrar notificação e tocar som
          if (notificationsEnabled) {
            const conversation = conversations.find(c => c.id === newMessage.conversation_id);
            const contactName = conversation?.contacts?.name || conversation?.contacts?.phone_number || 'Contato desconhecido';
            
            showNotification({
              title: 'Nova mensagem no WhatsApp',
              body: `${contactName}: ${newMessage.content?.substring(0, 50)}${newMessage.content && newMessage.content.length > 50 ? '...' : ''}`,
              tag: `message-${newMessage.conversation_id}`,
            });
            
            playNotificationSound();
          }
        }

        // Se é a conversa ativa, atualizar mensagens
        if (activeConversation?.id === newMessage.conversation_id) {
          setMessages(prev => [...prev, newMessage]);
        }
      })
      .subscribe((status: string, err: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao canal de mensagens em tempo real!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal de mensagens:', err);
        }
      });

    channelRef.current = conversationsChannel;
    messagesChannelRef.current = messagesChannel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
      }
    };
  }, [user, fetchConversations, activeConversation, conversations, notificationsEnabled, showNotification, playNotificationSound]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      // Limpar contador de não lidas
      setUnreadCounts(prev => ({
        ...prev,
        [activeConversation.id]: 0
      }));
    }
  }, [activeConversation, fetchMessages]);

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setActiveConversation(conversation);
    // Limpar contador de não lidas
    setUnreadCounts(prev => ({
      ...prev,
      [conversation.id]: 0
    }));
  };

  const handleToggleNotifications = async () => {
    if (permission === 'default') {
      const result = await requestPermission();
      if (result === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notificações ativadas!');
      } else {
        toast.error('Permissão para notificações negada');
      }
    } else {
      setNotificationsEnabled(!notificationsEnabled);
      toast.success(notificationsEnabled ? 'Notificações desativadas' : 'Notificações ativadas');
    }
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
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem', { description: error.message });
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNote.trim() || !activeConversation || !user) return;

    try {
      await dbClient.messages.create({
        conversation_id: activeConversation.id,
        content: internalNote,
        sender_is_user: true,
        message_type: 'internal',
      });

      setInternalNote('');
      toast.success('Nota interna adicionada!');
      fetchMessages(activeConversation.id);
    } catch (error: any) {
      toast.error('Erro ao adicionar nota', { description: error.message });
    }
  };

  const filteredConversations = conversations
    .filter(c => c.status === activeFilter)
    .filter(c => {
      if (!searchTerm) return true;
      const contactName = c.contacts?.name?.toLowerCase() || '';
      const contactPhone = c.contacts?.phone_number || '';
      const search = searchTerm.toLowerCase();
      return contactName.includes(search) || contactPhone.includes(search);
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar esquerda - Lista de conversas */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-green-600 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Caixa de Entrada</h1>
            <div className="flex items-center gap-2">
              {/* Status de conexão em tempo real */}
              <div className="flex items-center gap-1 text-xs">
                {isRealtimeConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </>
                )}
              </div>
              
              {/* Botão de notificações */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleNotifications}
                className="text-white hover:bg-white/20 p-1"
                title={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
              >
                {notificationsEnabled && permission === 'granted' ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </Button>
              
              {/* Botão de sincronização */}
              <Button
                variant="ghost"
                size="sm"
                onClick={syncWhatsAppChats}
                disabled={syncing}
                className="text-white hover:bg-white/20 p-1"
                title="Sincronizar conversas do WhatsApp"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou número"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex border-b bg-gray-50">
          {(['active', 'pending', 'resolved'] as ConversationStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                activeFilter === status
                  ? "bg-white text-green-600 border-b-2 border-green-600"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              {status === 'active' && 'Ativos'}
              {status === 'pending' && 'Aguardando'}
              {status === 'resolved' && 'Finalizados'}
            </button>
          ))}
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {syncing && (
            <div className="p-3 bg-blue-50 border-b text-center">
              <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sincronizando conversas do WhatsApp...</span>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <User className="w-16 h-16 mx-auto text-gray-300" />
              </div>
              <h3 className="font-medium text-gray-700 mb-2">Nenhuma conversa encontrada</h3>
              <p className="text-sm text-gray-500 mb-4">
                {activeFilter === 'pending' 
                  ? 'Não há conversas pendentes no momento'
                  : `Não há conversas ${activeFilter === 'active' ? 'ativas' : 'finalizadas'}`
                }
              </p>
              <Button
                onClick={syncWhatsAppChats}
                disabled={syncing}
                size="sm"
                className="bg-green-500 hover:bg-green-600"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                Sincronizar WhatsApp
              </Button>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={cn(
                  "p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors",
                  activeConversation?.id === conversation.id && "bg-green-50 border-r-4 border-r-green-500"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-gray-600" />
                    </div>
                    {(conversation.unreadCount || unreadCounts[conversation.id]) && (conversation.unreadCount || unreadCounts[conversation.id]) > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conversation.unreadCount || unreadCounts[conversation.id]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.contacts?.name || conversation.contacts?.phone_number || 'Desconhecido'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(conversation.updated_at).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage?.content || 'Nenhuma mensagem'}
                    </p>
                    {conversation.status === 'active' && (
                      <span className="inline-block mt-1 text-xs text-green-600 font-medium">
                        Online
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área central do chat */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Header do chat */}
            <div className="bg-green-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {activeConversation.contacts?.name || 'Cliente'}
                  </h2>
                  <p className="text-sm text-green-100">Online</p>
                </div>
              </div>

              {/* Ações do chat */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Reabrir Ticket"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Agendamento"
                >
                  <Calendar className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Mover p/ Pendente"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Resolver Conversa"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Transferir Conversa"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
              {messages.filter(m => !m.internal_message).map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.sender_is_user ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm",
                      message.sender_is_user
                        ? "bg-green-500 text-white rounded-br-none"
                        : "bg-white text-gray-900 rounded-bl-none"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={cn(
                      "text-xs mt-1 text-right",
                      message.sender_is_user ? "text-green-100" : "text-gray-500"
                    )}>
                      {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input de mensagem */}
            <div className="bg-white border-t p-4">
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
                <Button variant="ghost" size="sm" className="p-2">
                  <Smile className="w-5 h-5 text-gray-500" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                </Button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-transparent px-2 py-1 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 rounded-full p-2"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-gray-500">
                Escolha uma conversa da lista para começar a atender
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Painel direito - Perfil do cliente */}
      {activeConversation && (
        <div className="w-80 bg-white border-l flex flex-col">
          {/* Perfil */}
          <div className="p-6 border-b text-center">
            <div className="w-20 h-20 rounded-full bg-gray-300 mx-auto mb-4 flex items-center justify-center">
              <User className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">
              {activeConversation.contacts?.name || 'Maria Souza'}
            </h3>
            <p className="text-gray-600 flex items-center justify-center gap-1 mt-1">
              <Phone className="w-4 h-4" />
              {activeConversation.contacts?.phone_number || '+55 11 98765-4321'}
            </p>
            
            <div className="flex justify-center gap-2 mt-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                VIP
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Cliente Novo
              </span>
            </div>
          </div>

          {/* Notas Internas */}
          <div className="p-4 border-b">
            <button
              onClick={() => setShowInternalNotes(!showInternalNotes)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="font-medium text-gray-900">Notas Internas</span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                showInternalNotes && "rotate-180"
              )} />
            </button>
            
            {showInternalNotes && (
              <div className="mt-3 space-y-3">
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Adicione uma nota sobre o cliente..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                />
                <Button
                  onClick={handleAddInternalNote}
                  disabled={!internalNote.trim()}
                  size="sm"
                  className="w-full bg-green-500 hover:bg-green-600"
                >
                  Adicionar Nota
                </Button>
                
                {/* Notas existentes */}
                <div className="space-y-2">
                  {messages.filter(m => m.internal_message).map((note) => (
                    <div key={note.id} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                      <p className="text-gray-700">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(note.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ações do cliente */}
          <div className="p-4 space-y-3">
            <Button variant="outline" className="w-full justify-start hover:bg-gray-50">
              <UserPlus className="w-4 h-4 mr-2" />
              Anexar cliente a uma carteira
            </Button>
            
            <Button variant="outline" className="w-full justify-start hover:bg-gray-50">
              <FileText className="w-4 h-4 mr-2" />
              Criar protocolo manual
            </Button>
            
            <Button variant="outline" className="w-full justify-start hover:bg-gray-50">
              <Star className="w-4 h-4 mr-2" />
              Enviar avaliação de atendimento
            </Button>
          </div>

          {/* Histórico */}
          <div className="p-4 border-t">
            <button className="flex items-center justify-between w-full text-left">
              <span className="font-medium text-gray-900">Histórico de Atendimentos</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}