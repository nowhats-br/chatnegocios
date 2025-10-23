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
import { dbClient } from '@/lib/dbClient';
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
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.conversations.listWithContact();
      const grouped = (data as Conversation[]).reduce((acc: ConversationMap, convo: Conversation) => {
        const status = convo.status || 'new';
        if (!acc[status]) acc[status] = [];
        acc[status].push(convo as Conversation);
        return acc;
      }, {} as ConversationMap);

      setConversations({
        new: grouped.new || [],
        active: grouped.active || [],
        pending: grouped.pending || [],
        resolved: grouped.resolved || [],
      });
    } catch (error: any) {
      toast.error('Erro ao buscar conversas para o Kanban', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Removido canal realtime; usar fetchConversations quando necessário

  const findContainer = (id: string): ConversationStatus | undefined => {
    if (columns.some(c => c.id === id)) {
      return id as ConversationStatus;
    }
    for (const status of Object.keys(conversations) as ConversationStatus[]) {
      if (conversations[status].find((c) => c.id === id)) {
        return status;
      }
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const originalContainer = findContainer(active.id as string);
    const newContainerId = over.id as string;
    const newContainer = findContainer(newContainerId);

    if (!originalContainer || !newContainer || originalContainer === newContainer) {
      return;
    }

    const conversationId = active.id as string;
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
    try {
      await dbClient.conversations.update(conversationId, { status: newStatus });
      toast.success('Status da conversa atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar status da conversa', { description: error.message });
      // Revert optimistic update
      fetchConversations();
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
