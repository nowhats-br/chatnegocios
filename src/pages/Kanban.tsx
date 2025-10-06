import React from 'react';
import KanbanBoard from '@/components/kanban/KanbanBoard';

const Kanban: React.FC = () => {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <h1 className="text-3xl font-bold tracking-tight">Kanban de Atendimentos</h1>
      <div className="flex-1 min-h-0">
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Kanban;
