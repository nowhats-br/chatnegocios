import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Conversation, ConversationStatus } from '@/types/database';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  id: ConversationStatus;
  title: string;
  conversations: Conversation[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, conversations }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="w-80 flex-shrink-0 bg-secondary rounded-lg flex flex-col"
    >
      <div className="p-4 border-b border-border">
        <h3 className="typography-h5 font-semibold text-foreground">{title} <span className="typography-body-sm typography-muted">{conversations.length}</span></h3>
      </div>
      <div className="flex-1 p-2 overflow-y-auto space-y-2">
        <SortableContext items={conversations.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {conversations.map((convo) => (
            <KanbanCard key={convo.id} conversation={convo} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
