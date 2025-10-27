import React from 'react';
// import KanbanBoard from '@/components/kanban/KanbanBoard';

const Kanban: React.FC = () => {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <h1 className="typography-h1">Kanban de Atendimentos</h1>
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
          <p className="text-muted-foreground">Kanban em desenvolvimento</p>
        </div>
      </div>
    </div>
  );
};

export default Kanban;
