import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Conversation, ConversationStatus, MessageType } from '@/types/database';
import { dbClient } from '@/lib/dbClient';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import Button from '@/components/ui/Button';
import { useEvolutionMessaging } from '@/hooks/useEvolutionMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle } from 'lucide-react';

const AtendimentoRealtime: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');
  const { sendText, sendMedia } = useEvolutionMessaging();
  const { user } = useAuth();
  const didSyncRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.conversations.listWithContact();
      setConversations(data as Conversation[]);
    } catch (error: any) {
      toast.error('Erro ao buscar conversas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  const syncWithEvolution = useCallback(async () => {
    try {
      const connections = await dbClient.connections.list();
      const connected = (connections || []).find((c: any) => String(c.status).toUpperCase() === 'CONNECTED');
      if (!connected) {
        toast.warning('Nenhuma conexão Evolution está ativa. Vá em Conexões e conecte.');
        return;
      }
      const instanceName = String(connected.instance_name);
      const r = await dbClient.evolution.syncChats({ instance_name: instanceName, limit: 20 });
      if (r?.ok) {
        toast.success(`Sincronizadas ${r.count} conversas da Evolution`);
        await fetchConversations();
      }
    } catch (error: any) {
      toast.error('Falha ao sincronizar conversas com Evolution', { description: error.message });
    }
  }, [fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // WebSocket para atualizações em tempo real
  useEffect(() => {
    if (!user) return;
    const apiBase = (import.meta.env.VITE_BACKEND_URL as string) || window.location.origin;
    const wsSchemeBase = apiBase.startsWith('https') ? apiBase.replace(/^https/, 'wss') : apiBase.replace(/^http/, 'ws');
    const wsUrl = `${wsSchemeBase}/ws?user_id=${encodeURIComponent(user.id)}`;

    let killed = false;
    let attempts = 0;
    let ws: WebSocket | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { 
        attempts = 0; 
        if (!didSyncRef.current) {
          syncWithEvolution();
          didSyncRef.current = true;
        }
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data?.type === 'conversation_upsert' && data.conversation) {
            const conv = data.conversation as Conversation;
            setConversations(prev => {
              const idx = prev.findIndex(c => c.id === conv.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = conv;
                return next;
              }
              return [conv, ...prev];
            });
          } else if (data?.type === 'message_new' && data.message) {
            const msg = data.message as { conversation_id: string };
            setConversations(prev => {
              const exists = prev.some(c => c.id === msg.conversation_id);
              const next = prev.map(c => c.id === msg.conversation_id ? { ...c, updated_at: new Date().toISOString(), status: c.status === 'resolved' ? 'pending' : c.status } : c);
              if (!exists) {
                // Se a conversa não existe localmente, tentar sincronizar rapidamente
                syncWithEvolution();
              }
              return next;
            });
          }
        } catch (_e) {}
      };
      ws.onerror = () => { /* reconectar no close */ };
      ws.onclose = () => {
        if (killed) return;
        attempts += 1;
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      killed = true;
      try { ws?.close(); } catch (_e) {}
    };
  }, [user, syncWithEvolution]);


  const sendMessage = async (content: string, type: MessageType, fileName?: string) => {
    if (!activeConversation || !user) {
      toast.error('Nenhuma conversa ativa selecionada.');
      return;
    }

    try {
      await dbClient.messages.create({
        conversation_id: activeConversation.id,
        content,
        sender_is_user: true,
        message_type: type,
        user_id: user.id,
      });
    } catch (e: any) {
      toast.error('Erro ao salvar mensagem no banco.', { description: e.message });
      return;
    }

    if (!activeConversation.connection_id || !activeConversation.contacts?.phone_number) {
      toast.error('Dados da conversa incompletos para envio.');
      return;
    }

    let connectionData: any;
    try {
      connectionData = await dbClient.connections.getById(activeConversation.connection_id);
    } catch (e: any) {
      toast.error('Erro ao buscar dados da conexão.', { description: e.message });
      return;
    }

    const instanceName = connectionData.instance_name;
    const to = activeConversation.contacts.phone_number;
    let sendOk = false;
    let sendError: string | undefined;

    switch (type) {
      case 'text': {
        const res = await sendText(instanceName, to, content);
        sendOk = res.ok;
        sendError = res.error;
        break;
      }
      case 'image': {
        const res = await sendMedia(instanceName, to, content, { mediatype: 'image', caption: '' });
        sendOk = res.ok;
        sendError = res.error;
        break;
      }
      case 'file': {
        const res = await sendMedia(instanceName, to, content, { mediatype: 'document', fileName: fileName || 'arquivo' });
        sendOk = res.ok;
        sendError = res.error;
        break;
      }
      default:
        toast.error('Tipo de mensagem não suportado.');
        return;
    }

    if (!sendOk) {
      toast.error('Falha ao enviar mensagem via API Evolution', { description: sendError });
    }
  };

  const handleSendAttachment = async (file: File) => {
    if (!user) return;
    const toastId = toast.loading('Enviando anexo...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const messageType: MessageType = file.type.startsWith('image/') ? 'image' : 'file';
        await sendMessage(dataUrl, messageType, file.name);
        toast.success('Anexo enviado com sucesso!', { id: toastId });
      };
      reader.onerror = () => {
        toast.error('Falha ao ler arquivo', { id: toastId });
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error('Falha no envio do anexo', { id: toastId, description: error.message });
    }
  };

  const handleResolveConversation = async () => {
    if (!activeConversation) return;
    try {
      await dbClient.conversations.update(activeConversation.id, { status: 'resolved' });
      toast.success('Conversa marcada como resolvida!');
      setConversations(prev => prev.filter(c => c.id !== activeConversation.id));
      setActiveConversation(null);
    } catch (error: any) {
      toast.error('Erro ao resolver conversa', { description: error.message });
    }
  };

  const filteredConversations = conversations.filter(c => c.status === activeFilter);

  return (
    <div className="flex h-[calc(100vh-110px)] bg-card border rounded-lg overflow-hidden">
      <ConversationList
        conversations={filteredConversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={setActiveConversation}
        onOpenTicket={async () => { /* tickets já são gerados como pendente via webhook */ }}
        loading={loading}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="flex-1 flex flex-col bg-chat-bg dark:bg-chat-bg-dark">
        <div className="flex items-center justify-between p-3 bg-card border-b">
          <div className="flex items-center space-x-2">
            {/* Removido botão de sincronização manual; sincronização ocorre automaticamente no onopen do WebSocket */}
          </div>
          <div className="flex items-center space-x-2">
            {activeConversation && (
              <Button variant="outline" size="sm" onClick={handleResolveConversation}>
                <CheckCircle className="mr-2 h-4 w-4"/> Resolver
              </Button>
            )}
          </div>
        </div>

        {activeConversation ? (
          <ChatWindow
            key={activeConversation.id}
            conversation={activeConversation as any}
            onSendMessage={(content) => sendMessage(content, 'text')}
            onSendAttachment={handleSendAttachment}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Selecione uma conversa pendente para atender.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtendimentoRealtime;