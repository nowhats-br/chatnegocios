import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Conversation, Message, QuickResponse } from '@/types/database';
import { toast } from 'sonner';
import { User, MoreVertical, Loader2, FileText, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import MessageInput from './MessageInput';
import { useAuth } from '@/contexts/AuthContext';
import Popover from '../ui/Popover';

type ConversationWithContact = Conversation & {
  contacts: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

interface ChatWindowProps {
  conversation: ConversationWithContact;
  onSendMessage: (content: string) => Promise<void>;
  onSendAttachment: (file: File) => Promise<void>;
  headerActions?: React.ReactNode;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, onSendMessage, onSendAttachment, headerActions }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQuickResponseOpen, setQuickResponseOpen] = useState(false);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Erro ao buscar mensagens', { description: error.message });
      setMessages([]);
    } else {
      setMessages(data);
    }
    setLoading(false);
  }, []);

  const fetchQuickResponses = useCallback(async () => {
    const { data, error } = await supabase.from('quick_responses').select('*');
    if (error) {
        toast.error('Erro ao buscar mensagens rápidas.');
    } else {
        setQuickResponses(data);
    }
  }, []);

  useEffect(() => {
    if (conversation.id) {
      fetchMessages(conversation.id);
    }
  }, [conversation.id, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on<Message>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, user?.id]);

  const handleLocalSendMessage = async (content: string) => {
    if (!user) return;
    
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

    await onSendMessage(content);
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

    await onSendAttachment(file);
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
              <p className="font-medium break-all">{msg.content?.split('/').pop()}</p>
              <p className="text-xs">Clique para baixar</p>
            </div>
            <Download className="h-5 w-5" />
          </a>
        );
      default:
        return <p>{msg.content}</p>;
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
            <p className="text-xs text-green-500">online</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {headerActions}
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
            messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_is_user ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg p-3 max-w-lg ${msg.sender_is_user ? 'bg-whatsapp-dark text-white' : 'bg-card'}`}>
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
    </>
  );
};

export default ChatWindow;
