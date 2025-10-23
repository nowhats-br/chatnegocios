import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Conversation } from '@/types/database';
type QuickResponse = {
  id: string;
  shortcut: string;
  message: string;
};
import { Message } from '@/types/chat';
import { toast } from 'sonner';
import { User, MoreVertical, Loader2, FileText, Download, CheckCircle, Share2, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import MessageInput from './MessageInput';
import { useAuth } from '@/contexts/AuthContext';
import Popover from '../ui/Popover';
import { dbClient } from '@/lib/dbClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import AlertDialog from '../ui/AlertDialog';

type ConversationWithContact = Conversation & {
  contacts: {
    name: string | null;
    avatar_url: string | null;
    phone_number: string;
  } | null;
};

interface ChatWindowProps {
  conversation: ConversationWithContact;
  onSendMessage: (content: string) => Promise<boolean>;
  onSendAttachment: (file: File) => Promise<boolean>;
  onResolveConversation: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, onSendMessage, onSendAttachment, onResolveConversation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQuickResponseOpen, setQuickResponseOpen] = useState(false);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const data = await dbClient.messages.listByConversation(conversationId);
      setMessages(data);
    } catch (error: any) {
      toast.error('Erro ao buscar mensagens', { description: error.message });
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuickResponses = useCallback(async () => {
    try {
      const data = await dbClient.quickResponses.list();
      setQuickResponses(data);
    } catch (_e) {
      toast.error('Erro ao buscar mensagens rápidas.');
    }
  }, []);

  useEffect(() => {
    if (conversation.id) {
      fetchMessages(String(conversation.id));
    }
  }, [conversation.id, fetchMessages]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages]);

  // Supabase Realtime para novas mensagens
  useEffect(() => {
    if (!conversation.id) return;

    const channel = supabase
      .channel(`public:messages:conversation_id=eq.${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === payload.new.id);
            return exists ? prev : [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  const handleLocalSendMessage = async (content: string) => {
    if (!user || !content.trim()) return;
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_is_user: true,
        content: content,
        message_type: 'text',
        created_at: new Date().toISOString(),
        user_id: user.id
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');

    const success = await onSendMessage(content);
    if (!success) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setMessageText(content);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_is_user: true,
        content: `Enviando ${file.name}...`,
        message_type: file.type.startsWith('image/') ? 'image' : 'file',
        created_at: new Date().toISOString(),
        user_id: user.id
    };
    setMessages(prev => [...prev, optimisticMessage]);

    const success = await onSendAttachment(file);
    if (!success) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  const handleQuickResponseClick = () => {
    if (quickResponses.length === 0) {
        fetchQuickResponses();
    }
    setQuickResponseOpen(prev => !prev);
  }

  const handleSelectQuickResponse = (message: string) => {
    setMessageText(prev => prev ? `${prev} ${message}` : message);
    setQuickResponseOpen(false);
  }

  const confirmDeleteConversation = async () => {
    setIsDeleting(true);
    try {
        await supabase.from('messages').delete().eq('conversation_id', conversation.id);
        await supabase.from('conversations').delete().eq('id', conversation.id);
        toast.success("Conversa e mensagens foram excluídas.");
        // A atualização da lista de conversas será tratada pela subscription na página pai.
        // Aqui, apenas fechamos o modal.
        setAlertOpen(false);
    } catch (error: any) {
        toast.error("Erro ao excluir conversa", { description: error.message });
    } finally {
        setIsDeleting(false);
    }
  };

  const renderMessageContent = (msg: Message) => {
    switch (msg.message_type) {
      case 'image':
        return (
          <a href={msg.content || ''} target="_blank" rel="noopener noreferrer">
            <img src={msg.content || ''} alt="Anexo de imagem" className="rounded-lg max-w-xs cursor-pointer" />
          </a>
        );
      case 'file':
        return (
          <a href={msg.content || ''} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 p-3 bg-black/10 rounded-lg hover:bg-black/20">
            <FileText className="h-8 w-8" />
            <div className="flex-1">
              <p className="font-medium break-all">{msg.content?.split('/').pop()?.split('?')[0] || 'arquivo'}</p>
              <p className="text-xs">Clique para baixar</p>
            </div>
            <Download className="h-5 w-5" />
          </a>
        );
      default:
        return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }
  }

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-card border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">{conversation.contacts?.name || 'Desconhecido'}</p>
            <p className="text-xs text-muted-foreground">{conversation.contacts?.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toast.info('Função em desenvolvimento', { description: 'A transferência de conversas estará disponível em breve.'})}
            >
                <Share2 className="mr-2 h-4 w-4"/> Transferir
            </Button>
            <Button 
                variant="default" 
                size="sm" 
                onClick={onResolveConversation}
                disabled={conversation.status === 'resolved'}
            >
                <CheckCircle className="mr-2 h-4 w-4"/> 
                {conversation.status === 'resolved' ? 'Resolvido' : 'Resolver'}
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-red-500" onSelect={() => setAlertOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir Conversa
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
            messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_is_user ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg p-3 max-w-lg shadow-sm ${msg.sender_is_user ? 'bg-whatsapp-dark text-white' : 'bg-card'}`}>
                        {renderMessageContent(msg)}
                        <p className={`text-xs text-right mt-1 ${msg.sender_is_user ? 'text-gray-300' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="relative">
        <MessageInput 
            onSendMessage={handleLocalSendMessage} 
            onQuickResponseClick={handleQuickResponseClick}
            onFileSelect={handleFileSelect}
            text={messageText}
            setText={setMessageText}
        />
        <Popover
            isOpen={isQuickResponseOpen}
            onClose={() => setQuickResponseOpen(false)}
            align="top"
            className="w-80 bottom-full mb-2"
        >
            <div className="p-2">
                <h4 className="text-sm font-medium px-2 pb-2">Mensagens Rápidas</h4>
                <div className="max-h-60 overflow-y-auto">
                    {quickResponses.length > 0 ? quickResponses.map(qr => (
                        <button 
                            key={qr.id} 
                            onClick={() => handleSelectQuickResponse(qr.message)}
                            className="w-full text-left p-2 rounded-md hover:bg-accent"
                        >
                            <p className="font-mono text-xs text-primary">/{qr.shortcut}</p>
                            <p className="text-sm text-muted-foreground truncate">{qr.message}</p>
                        </button>
                    )) : <p className="text-sm text-muted-foreground p-2">Nenhuma mensagem rápida cadastrada.</p>}
                </div>
            </div>
        </Popover>
      </div>
      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDeleteConversation}
        title="Excluir Conversa?"
        description="Esta ação é irreversível e irá apagar todas as mensagens desta conversa permanentemente."
        confirmText="Excluir"
        isConfirming={isDeleting}
      />
    </>
  );
};

export default ChatWindow;
