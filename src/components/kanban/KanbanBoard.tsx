import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DropAnimation,
  defaultDropAnimation,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Conversation, ConversationStatus } from '@/types/database';
import { Loader2 } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

const columns: { id: ConversationStatus; title: string }[] = [
  { id: 'new', title: 'Novos' },
  { id: 'active', title: 'Em Atendimento' },
  { id: 'pending', title: 'Aguardando' },
  { id: 'resolved', title: 'Resolvido' },
];

type ConversationMap = Record<ConversationStatus, Conversation[]>;

const KanbanBoard: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationMap>({
    new: [],
    active: [],
    pending: [],
    resolved: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('*, contacts(name, avatar_url)')
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Erro ao buscar conversas para o Kanban', { description: error.message });
    } else {
      const grouped: ConversationMap = { new: [], active: [], pending: [], resolved: [] };
      (data as Conversation[]).forEach((convo) => {
        const status = (convo.status ?? 'new') as ConversationStatus;
        grouped[status].push(convo);
      });

      setConversations({
        new: grouped.new || [],
        active: grouped.active || [],
        pending: grouped.pending || [],
        resolved: grouped.resolved || [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const channel = supabase
      .channel('kanban-conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  const findContainer = (id: string | number): ConversationStatus | undefined => {
    if (columns.some(c => c.id === id)) {
      return id as ConversationStatus;
    }
    const convId = typeof id === 'string' ? Number(id) : id;
    for (const status of Object.keys(conversations) as ConversationStatus[]) {
      if (conversations[status].find((c) => c.id === convId)) {
        return status;
      }
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
    setActiveId(typeof id === 'string' ? Number(id) : id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const originalContainer = findContainer(active.id);
    const newContainerId = over.id as string;
    const newContainer = findContainer(newContainerId);

    if (!originalContainer || !newContainer || originalContainer === newContainer) {
      return;
    }

    const conversationId = typeof active.id === 'string' ? Number(active.id) : (active.id as number);
    const newStatus = newContainer as ConversationStatus;

    // Optimistic update
    setConversations((prev) => {
      const newConversations = { ...prev };
      const activeList = newConversations[originalContainer];
      const overList = newConversations[newContainer];
      const activeIndex = activeList.findIndex((c) => c.id === conversationId);
      
      if (activeIndex === -1) return prev;

      const [movedItem] = activeList.splice(activeIndex, 1);
      movedItem.status = newStatus;
      overList.push(movedItem);
      return newConversations;
    });

    // Update database
    const { error } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', conversationId);

    if (error) {
      toast.error('Erro ao atualizar status da conversa', { description: error.message });
      // Revert optimistic update
      fetchConversations();
    } else {
      toast.success('Status da conversa atualizado!');
    }
  };
  
  const activeConversation = activeId ? Object.values(conversations).flat().find(c => c.id === activeId) : null;
  const dropAnimation: DropAnimation = { ...defaultDropAnimation };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto h-full pb-4">
        {columns.map((column) => (
          <KanbanColumn key={column.id} id={column.id} title={column.title} conversations={conversations[column.id] || []} />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeConversation ? <KanbanCard conversation={activeConversation} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
