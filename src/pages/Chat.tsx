import React, { useState, useEffect, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Conversation, Product, ConversationStatus, MessageType } from '@/types/database';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart, Loader2, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { formatCurrency } from '@/lib/utils';
import { useEvolutionMessaging } from '@/hooks/useEvolutionMessaging';
import { useAuth } from '@/contexts/AuthContext';


const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSalesSidebarOpen, setSalesSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const { sendText, sendMedia } = useEvolutionMessaging();
  const { user } = useAuth();
const [activeFilter, setActiveFilter] = useState<ConversationStatus>('pending');

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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);
// WebSocket para atualizações em tempo real no chat
useEffect(() => {
  if (!user) return;
  const apiBase = (import.meta.env.VITE_BACKEND_URL as string) || `${window.location.protocol}//${window.location.hostname}:3001`;
  const wsSchemeBase = apiBase.startsWith('https') ? apiBase.replace(/^https/, 'wss') : apiBase.replace(/^http/, 'ws');
  const wsUrl = `${wsSchemeBase}/ws?user_id=${encodeURIComponent(user.id)}`;
  const ws = new WebSocket(wsUrl);

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
        setConversations(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, updated_at: new Date().toISOString() } : c));
      }
    } catch (_e) {
      // ignorar mensagens inválidas
    }
  };

  return () => {
    try { ws.close(); } catch (_e) {}
  };
}, [user]);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await dbClient.products.list();
      setProducts(data as Product[]);
    } catch (error: any) {
      toast.error('Erro ao buscar produtos', { description: error.message });
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const sendMessage = async (content: string, type: MessageType, fileName?: string) => {
    if (!activeConversation || !user) {
        toast.error("Nenhuma conversa ativa selecionada.");
        return;
    }

    // 1. Save message to DB
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

    // 2. Get connection data
    if (!activeConversation.connection_id || !activeConversation.contacts?.phone_number) {
        toast.error("Dados da conversa incompletos para envio.");
        return;
    }

    let connectionData: any;
    try {
      connectionData = await dbClient.connections.getById(activeConversation.connection_id);
    } catch (e: any) {
      toast.error('Erro ao buscar dados da conexão.', { description: e.message });
      return;
    }

    // 3. Prepare payload and send via API
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
      toast.error('Falha ao enviar mensagem via API', { description: sendError });
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


  const handleSendProduct = (product: Product) => {
    if (!activeConversation) return;
    const messageContent = `Olá! Segue o produto que você se interessou:\n\n*${product.name}*\n${product.description || ''}\n\n*Preço: ${formatCurrency(product.price)}*`;
    sendMessage(messageContent, 'text');
    setSalesSidebarOpen(false);
    toast.success(`Produto "${product.name}" enviado na conversa.`);
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

  const handleOpenTicket = async (convo: Conversation) => {
    try {
      await dbClient.conversations.update(convo.id, { status: 'active' });
      toast.success('Ticket aberto!');
      setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, status: 'active' } : c));
      setActiveConversation({ ...convo, status: 'active' });
      setActiveFilter('active');
    } catch (error: any) {
      toast.error('Erro ao abrir ticket', { description: error.message });
    }
  };

  useEffect(() => {
    if (isSalesSidebarOpen && products.length === 0) {
      fetchProducts();
    }
  }, [isSalesSidebarOpen, products.length, fetchProducts]);

  const filteredConversations = conversations.filter(c => c.status === activeFilter);

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
            onSendMessage={(content) => sendMessage(content, 'text')}
            onSendAttachment={handleSendAttachment}
            headerActions={
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleResolveConversation}>
                  <CheckCircle className="mr-2 h-4 w-4"/> Resolver
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSalesSidebarOpen(!isSalesSidebarOpen)}>
                  <ShoppingCart className="mr-2 h-4 w-4"/> Iniciar Venda
                </Button>
              </div>
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <img src="/placeholder-chat.svg" alt="Selecione uma conversa" className="w-64 h-64" />
            <h2 className="mt-4 text-2xl font-semibold">Selecione uma conversa</h2>
            <p className="text-muted-foreground">Escolha um dos seus contatos para começar a conversar.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isSalesSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 350, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-l flex flex-col bg-card"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Catálogo de Produtos</h3>
              <Button variant="ghost" size="icon" onClick={() => setSalesSidebarOpen(false)}>X</Button>
            </div>
            <div className="p-4">
               <input type="text" placeholder="Buscar produto..." className="w-full px-3 py-2 rounded-lg bg-secondary border focus:outline-none focus:border-primary"/>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {loadingProducts ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
              ) : products.map(product => (
                <div key={product.id} onClick={() => handleSendProduct(product)} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                  <img src={product.image_url || `https://img-wrapper.vercel.app/image?url=https://placehold.co/48x48/cccccc/FFFFFF/png?text=${product.name.charAt(0)}`} alt={product.name} className="w-12 h-12 rounded-md object-cover"/>
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-primary font-semibold">{formatCurrency(product.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
