import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Conversation, ConversationStatus, Message as TMessage } from '@/types/database';
import { dbClient } from '@/lib/dbClient';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { useEvolutionMessaging } from '@/hooks/useEvolutionMessaging';
import { useAuth } from '@/contexts/AuthContext';
import placeholderChat from '/placeholder-chat.svg';
import { RealtimeChannel } from '@supabase/supabase-js';

const AtendimentoRealtime: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');
  const { sendText, sendMedia } = useEvolutionMessaging();
  const { user } = useAuth();
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.conversations.listWithContact();
      setConversations(data);
    } catch (error: any) {
      toast.error('Erro ao buscar conversas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Supabase Realtime para atualizações
  useEffect(() => {
    if (!user) return;

    // Remove canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`public:conversations:user_id=eq.${user.id}`);
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          console.log('Conversation change received!', payload);
          fetchConversations(); // Simplesmente recarrega tudo ao receber qualquer evento
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          console.log('New message received!', payload);
          const newMessage = payload.new as TMessage;
          // Atualiza a conversa para aparecer no topo
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
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Conectado ao canal de atendimento em tempo real!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal de realtime:', err);
          toast.error("Erro na conexão em tempo real", { description: err?.message });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, fetchConversations]);

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'file', fileName?: string): Promise<boolean> => {
    if (!activeConversation || !user) {
      toast.error('Nenhuma conversa ativa selecionada.');
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

    // Busca dados da conexão para envio via API
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

    let result = { ok: false, error: 'Tipo de mensagem não suportado.' };

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

  const handleOpenTicket = async (conversation: Conversation) => {
    try {
      const updated = await dbClient.conversations.update(conversation.id, { status: 'active' });
      toast.success(`Ticket #${conversation.id.slice(0, 6)} aberto!`);
      
      setConversations(prev => prev.map(c => c.id === conversation.id ? updated : c));
      setActiveConversation(updated);
      setActiveFilter('active');
    } catch (error: any) {
      toast.error("Erro ao abrir ticket", { description: error.message });
    }
  };

  const filteredConversations = conversations
    .filter(c => c.status === activeFilter)
    .sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="flex h-[calc(100vh-110px)] bg-card border rounded-lg overflow-hidden">
      <ConversationList
        conversations={filteredConversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={setActiveConversation}
        onOpenTicket={handleOpenTicket}
        loading={loading}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="flex-1 flex flex-col bg-chat-bg dark:bg-chat-bg-dark">
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
            <img src={placeholderChat} alt="Selecione uma conversa" className="w-64 h-64" />
            <h2 className="mt-6 text-xl font-semibold text-foreground">Nenhuma conversa selecionada</h2>
            <p className="mt-2 text-muted-foreground">Selecione uma conversa na lista à esquerda para começar a atender.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtendimentoRealtime;
