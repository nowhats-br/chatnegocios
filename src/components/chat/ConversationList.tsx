import React, { useState } from 'react';
import { Search, User, Loader2, AlertTriangle, Ticket, RefreshCw, CheckCircle, Info } from 'lucide-react';
import { Tabs, TabsTrigger } from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import { Conversation, ConversationStatus } from '@/types/database';
import { cn } from '@/lib/utils';
// SyncStatus removido - agora usa sincronização automática

type ConversationWithLastMessage = Conversation & {
  lastMessage?: {
    content: string | null;
    created_at: string;
    sender_is_user: boolean;
    message_type: string;
  } | null;
};

interface ConversationListProps {
  conversations: ConversationWithLastMessage[];
  activeConversationId?: string;
  onSelectConversation: (conversation: ConversationWithLastMessage) => void;
  onOpenTicket: (conversation: ConversationWithLastMessage) => Promise<void> | void;
  loading: boolean;
  activeFilter: ConversationStatus;
  onFilterChange: (status: ConversationStatus) => void;
  unreadCounts?: Record<string, number>;
  onManualSync?: () => void;
  lastSyncTime?: Date | null;
  syncError?: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenTicket,
  loading,
  activeFilter,
  onFilterChange,
  unreadCounts = {},
  onManualSync,
  lastSyncTime,
  syncError
}) => {

  const getFilterCounts = () => {
    const counts = {
      pending: conversations.filter(c => c.status === 'pending').length,
      active: conversations.filter(c => c.status === 'active').length,
      resolved: conversations.filter(c => c.status === 'resolved').length,
    };
    return counts;
  };

  const filterCounts = getFilterCounts();

  const filters: { label: string; value: ConversationStatus; count: number }[] = [
    { label: 'Pendentes', value: 'pending', count: filterCounts.pending },
    { label: 'Ativas', value: 'active', count: filterCounts.active },
    { label: 'Resolvidas', value: 'resolved', count: filterCounts.resolved },
  ];

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(convo => {
    const contactName = convo.contacts?.name?.toLowerCase() || '';
    const contactPhone = convo.contacts?.phone_number || '';
    const search = searchTerm.toLowerCase();
    return contactName.includes(search) || contactPhone.includes(search);
  });

  return (
    <div className="w-full md:w-[380px] border-r flex flex-col bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversas</h2>
          {/* SyncStatus removido - agora usa sincronização automática */}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-transparent focus:bg-background focus:border-primary focus:outline-none"
          />
        </div>
        <Tabs className="mt-4">
          {filters.map(filter => (
            <TabsTrigger 
              key={filter.value}
              value={filter.value} 
              activeValue={activeFilter} 
              onClick={() => onFilterChange(filter.value)}
              className="relative"
            >
              {filter.label}
              {filter.count > 0 && (
                <span className={cn(
                  "ml-2 px-2 py-0.5 text-xs rounded-full",
                  filter.value === 'pending' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                  filter.value === 'active' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  filter.value === 'resolved' && "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                )}>
                  {filter.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </Tabs>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredConversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              {searchTerm ? (
                <>
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 typography-h4">Nenhum resultado encontrado</h3>
                  <p className="mt-2 typography-body typography-muted">
                    Nenhuma conversa corresponde ao termo "{searchTerm}".
                  </p>
                </>
              ) : syncError ? (
                <>
                  <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                  <h3 className="mt-4 typography-h4 text-red-600 dark:text-red-400">Erro na sincronização</h3>
                  <p className="mt-2 typography-body typography-muted">
                    {syncError}
                  </p>
                  {onManualSync && (
                    <Button 
                      onClick={onManualSync} 
                      className="mt-4"
                      variant="outline"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tentar novamente
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 typography-h4">Nenhuma conversa {activeFilter === 'pending' ? 'pendente' : activeFilter === 'active' ? 'ativa' : 'resolvida'}</h3>
                  <p className="mt-2 typography-body typography-muted">
                    {activeFilter === 'pending' && 'Novas conversas aparecerão aqui quando chegarem mensagens.'}
                    {activeFilter === 'active' && 'Conversas ativas aparecerão aqui quando forem abertas.'}
                    {activeFilter === 'resolved' && 'Conversas resolvidas aparecerão aqui quando forem finalizadas.'}
                  </p>
                  {lastSyncTime && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      <CheckCircle className="inline w-3 h-3 mr-1" />
                      Última sincronização: {lastSyncTime.toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
        ) : (
          filteredConversations.map(convo => {
            const unreadCount = unreadCounts[convo.id] || 0;
            const hasUnread = unreadCount > 0;
            
            return (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo)}
                className={cn(
                  "p-4 flex items-center space-x-3 cursor-pointer hover:bg-accent transition-colors",
                  convo.id === activeConversationId && "bg-secondary border-r-2 border-primary",
                  hasUnread && "bg-blue-50 dark:bg-blue-950/20"
                )}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {convo.contacts?.avatar_url ? (
                      <img src={convo.contacts.avatar_url} alt={convo.contacts.name || 'Avatar'} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  {/* Indicador de status */}
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900",
                    convo.status === 'active' && "bg-green-500",
                    convo.status === 'pending' && "bg-yellow-500",
                    convo.status === 'resolved' && "bg-gray-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={cn(
                      "truncate",
                      hasUnread ? "font-bold text-foreground" : "font-semibold"
                    )}>
                      {convo.contacts?.name || convo.contacts?.phone_number || 'Desconhecido'}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(convo.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {hasUnread && (
                        <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      )}
                      {convo.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Abrir ticket"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setOpeningId(convo.id);
                            Promise.resolve(onOpenTicket(convo)).finally(() => setOpeningId(null));
                          }}
                          disabled={openingId === convo.id}
                          className="h-8 w-8"
                        >
                          {openingId === convo.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Ticket className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={cn(
                      "text-sm truncate flex-1 mr-2",
                      hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {convo.lastMessage ? (
                        <>
                          {convo.lastMessage.sender_is_user && (
                            <span className="text-blue-600 mr-1">Você:</span>
                          )}
                          {convo.lastMessage.message_type === 'image' && '📷 Imagem'}
                          {convo.lastMessage.message_type === 'file' && '📎 Arquivo'}
                          {convo.lastMessage.message_type === 'text' && convo.lastMessage.content}
                        </>
                      ) : (
                        'Nenhuma mensagem ainda'
                      )}
                    </p>
                    {/* Badge de status */}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      convo.status === 'pending' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                      convo.status === 'active' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                      convo.status === 'resolved' && "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    )}>
                      {convo.status === 'pending' && 'Pendente'}
                      {convo.status === 'active' && 'Ativo'}
                      {convo.status === 'resolved' && 'Resolvido'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
