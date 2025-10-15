import React from 'react';
import { Search, User, Loader2, AlertTriangle } from 'lucide-react';
import { Tabs, TabsTrigger } from '@/components/ui/Tabs';
import { Conversation, ConversationStatus } from '@/types/database';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: number;
  onSelectConversation: (conversation: Conversation) => void;
  loading: boolean;
  activeFilter: ConversationStatus;
  onFilterChange: (status: ConversationStatus) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  loading,
  activeFilter,
  onFilterChange
}) => {

  const filters: { label: string; value: ConversationStatus }[] = [
    { label: 'Ativos', value: 'active' },
    { label: 'Pendentes', value: 'pending' },
    { label: 'Novos', value: 'new' },
    { label: 'Resolvidos', value: 'resolved' },
  ];

  return (
    <div className="w-full md:w-[380px] border-r flex flex-col bg-card">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar ou começar uma nova conversa"
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
            >
              {filter.label}
            </TabsTrigger>
          ))}
        </Tabs>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma conversa encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">Não há conversas com o status "{activeFilter}".</p>
            </div>
        ) : (
          conversations.map(convo => (
            <div
              key={convo.id}
              onClick={() => onSelectConversation(convo)}
              className={cn(
                "p-4 flex items-center space-x-3 cursor-pointer hover:bg-accent",
                convo.id === activeConversationId && "bg-secondary"
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
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="font-semibold truncate">{convo.contacts?.name || 'Desconhecido'}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {convo.updated_at ? new Date(convo.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground truncate">Última mensagem aqui...</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
