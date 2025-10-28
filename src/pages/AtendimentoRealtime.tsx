import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Conversation, ConversationStatus, Message as TMessage } from '@/types/database';

type ConversationWithLastMessage = Conversation & {
  lastMessage?: {
    content: string | null;
    created_at: string;
    sender_is_user: boolean;
    message_type: string;
  } | null;
};
import { dbClient } from '@/lib/dbClient';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { useEvolutionMessaging, SendTextResult, SendMediaResult } from '@/hooks/useEvolutionMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { MessageSquareDashed, Bell, BellOff } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const AtendimentoRealtime: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { sendText, sendMedia } = useEvolutionMessaging();
  const { user } = useAuth();
  const { permission, requestPermission, showNotification, playNotificationSound } = useNotifications();
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.conversations.listWithContact();
      
      // Buscar última mensagem para cada conversa
      const conversationsWithLastMessage = await Promise.all(
        data.map(async (conv) => {
          try {
            const messages = await dbClient.messages.listByConversation(conv.id);
            const lastMessage = messages[messages.length - 1];
            return {
              ...conv,
              lastMessage: lastMessage ? {
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_is_user: lastMessage.sender_is_user,
                message_type: lastMessage.message_type
              } : null
            };
          } catch {
            return { ...conv, lastMessage: null };
          }
        })
      );
      
      setConversations(conversationsWithLastMessage);
    } catch (error: any) {
      toast.error('Erro ao buscar conversas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      fetchConversations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchConversations]);

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
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal de conversas:', err);
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
        const newMessage = payload.new as TMessage;
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
            // Buscar informações do contato para a notificação
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
  }, [user, fetchConversations, activeConversation]);

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'file', fileName?: string): Promise<boolean> => {
    if (!activeConversation || !user) {
      toast.error('Nenhuma conversa ativa selecionada.');
      return false;
    }

    if (!activeConversation.connection_id) {
        toast.error('Esta conversa não está vinculada a nenhuma conexão ativa.');
        return false;
    }

    try {
      await dbClient.messages.create({
        conversation_id: activeConversation.id,
        content,
        sender_is_user: true,
        message_type: type,
      });
    } catch (e: any) {
      toast.error('Erro ao salvar mensagem no banco de dados.', { description: e.message });
      return false;
    }

    const { data: connection, error: connError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', activeConversation.connection_id)
        .single();
    
    if (connError || !connection) {
        toast.error('Dados da conexão não encontrados para envio.');
        return false;
    }

    const instanceName = connection.instance_name;
    const to = activeConversation.contacts?.phone_number;

    if (!to) {
        toast.error('Número de telefone do contato não encontrado.');
        return false;
    }

    let result: SendTextResult | SendMediaResult = { ok: false, error: 'Tipo de mensagem não suportado.' };

    switch (type) {
      case 'text':
        result = await sendText(instanceName, to, content);
        break;
      case 'image':
        result = await sendMedia(instanceName, to, content, { mediatype: 'image', caption: '' });
        break;
      case 'file':
        result = await sendMedia(instanceName, to, content, { mediatype: 'document', fileName: fileName || 'arquivo' });
        break;
    }

    if (!result.ok) {
      toast.error('Falha ao enviar mensagem via API Evolution', { description: result.error || 'Erro desconhecido' });
    }
    
    return result.ok;
  };

  const handleSendAttachment = async (file: File): Promise<boolean> => {
    if (!user) return false;
    const toastId = toast.loading('Enviando anexo...');
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const messageType = file.type.startsWith('image/') ? 'image' : 'file';
        const success = await handleSendMessage(dataUrl, messageType, file.name);
        if (success) {
          toast.success('Anexo enviado com sucesso!', { id: toastId });
        } else {
          toast.error('Falha no envio do anexo', { id: toastId });
        }
        resolve(success);
      };
      reader.onerror = () => {
        toast.error('Falha ao ler arquivo', { id: toastId });
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleResolveConversation = async () => {
    if (!activeConversation) return;
    try {
      await dbClient.conversations.update(activeConversation.id, { status: 'resolved' });
      toast.success('Conversa marcada como resolvida!');
      
      const updatedConversation = { ...activeConversation, status: 'resolved' as ConversationStatus };
      setActiveConversation(updatedConversation);
      setConversations(prev => prev.map(c => c.id === activeConversation.id ? updatedConversation : c));
      
      if (activeFilter !== 'resolved') {
        setActiveConversation(null);
      }

    } catch (error: any) {
      toast.error('Erro ao resolver conversa', { description: error.message });
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    // Limpar contador de não lidas
    setUnreadCounts(prev => ({
      ...prev,
      [conversation.id]: 0
    }));
  };

  const handleOpenTicket = async (conversation: Conversation) => {
    try {
      const updated = await dbClient.conversations.update(conversation.id, { status: 'active' });
      toast.success(`Ticket #${conversation.id.slice(0, 6)} aberto!`);
      
      setConversations(prev => prev.map(c => c.id === conversation.id ? updated : c));
      setActiveConversation(updated);
      setActiveFilter('active');
      
      // Limpar contador de não lidas
      setUnreadCounts(prev => ({
        ...prev,
        [conversation.id]: 0
      }));
    } catch (error: any) {
      toast.error("Erro ao abrir ticket", { description: error.message });
    }
  };

  const filteredConversations = conversations
    .filter(c => c.status === activeFilter)
    .sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const filterCounts = {
    pending: conversations.filter(c => c.status === 'pending').length,
    active: conversations.filter(c => c.status === 'active').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
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

  return (
    <div className="flex flex-col h-[calc(100vh-110px)]">
      {/* Header com controles */}
      <div className="flex items-center justify-between p-4 bg-card border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Chat WhatsApp</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>{filterCounts.pending} Pendentes</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{filterCounts.active} Ativas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>{filterCounts.resolved} Resolvidas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Tempo real ativo</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleNotifications}
            className={cn(
              notificationsEnabled && permission === 'granted' 
                ? "text-green-600 border-green-200 hover:bg-green-50" 
                : "text-gray-600"
            )}
          >
            {notificationsEnabled && permission === 'granted' ? (
              <Bell className="w-4 h-4 mr-2" />
            ) : (
              <BellOff className="w-4 h-4 mr-2" />
            )}
            {permission === 'granted' 
              ? (notificationsEnabled ? 'Notificações On' : 'Notificações Off')
              : 'Ativar Notificações'
            }
          </Button>
        </div>
      </div>

      <div className="flex flex-1 bg-card border rounded-lg overflow-hidden shadow-lg">
        <ConversationList
          conversations={filteredConversations}
          activeConversationId={activeConversation?.id}
          onSelectConversation={handleSelectConversation}
          onOpenTicket={handleOpenTicket}
          loading={loading}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          unreadCounts={unreadCounts}
        />

      <div className="flex-1 flex flex-col bg-secondary/50">
        {activeConversation ? (
          <ChatWindow
            key={activeConversation.id}
            conversation={activeConversation}
            onSendMessage={(content) => handleSendMessage(content, 'text')}
            onSendAttachment={handleSendAttachment}
            onResolveConversation={handleResolveConversation}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <MessageSquareDashed className="w-24 h-24 text-muted-foreground/50" />
            <h2 className="mt-6 typography-h3">Nenhuma conversa selecionada</h2>
            <p className="mt-2 typography-body typography-muted">Selecione uma conversa na lista à esquerda para começar a atender.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default AtendimentoRealtime;
