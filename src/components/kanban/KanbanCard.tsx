import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Conversation } from '@/types/database';
import { GripVertical, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  conversation: Conversation;
  isOverlay?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ conversation, isOverlay }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: conversation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "bg-card p-3 rounded-lg border shadow-sm cursor-grab",
        isDragging && "opacity-50",
        isOverlay && "shadow-2xl"
      )}
    >
      <div className="flex justify-between items-start">
        <p className="font-semibold text-sm mb-2 flex-1 break-words">{conversation.contacts?.name || 'Desconhecido'}</p>
        <div {...listeners} className="p-1 text-muted-foreground hover:bg-accent rounded-sm">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">
        Última mensagem aqui...
      </p>

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString('pt-BR') : ''}
        </p>
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          {conversation.contacts?.avatar_url ? (
            <img src={conversation.contacts.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
