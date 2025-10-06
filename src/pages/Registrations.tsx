import React, { useState } from 'react';
import Card, { CardContent } from '@/components/ui/Card';
import { Tabs, TabsTrigger } from '@/components/ui/Tabs';
import { ShoppingBag, User, MessageCircle, Users, Tag, List, Users2 } from 'lucide-react';
import ProductManager from '@/components/registrations/ProductManager';
import TagManager from '@/components/registrations/TagManager';
import ClientManager from '@/components/registrations/ClientManager';
import QuickResponseManager from '@/components/registrations/QuickResponseManager';
import TeamManager from '@/components/registrations/TeamManager';
import QueueManager from '@/components/registrations/QueueManager';

type ActiveTab = 'products' | 'clients' | 'tags' | 'quick_messages' | 'users_teams';

const Registrations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return <ProductManager />;
      case 'clients':
        return <ClientManager />;
      case 'tags':
        return <TagManager />;
      case 'quick_messages':
        return <QuickResponseManager />;
      case 'users_teams':
        return <UsersAndTeamsManager />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
      <Card>
        <div className="border-b">
          <Tabs className="px-6 overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="products" activeValue={activeTab} onClick={() => setActiveTab('products')} className="inline-flex items-center space-x-2">
              <ShoppingBag className="h-4 w-4" /> <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="clients" activeValue={activeTab} onClick={() => setActiveTab('clients')} className="inline-flex items-center space-x-2">
              <User className="h-4 w-4" /> <span>Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="tags" activeValue={activeTab} onClick={() => setActiveTab('tags')} className="inline-flex items-center space-x-2">
              <Tag className="h-4 w-4" /> <span>Etiquetas</span>
            </TabsTrigger>
            <TabsTrigger value="quick_messages" activeValue={activeTab} onClick={() => setActiveTab('quick_messages')} className="inline-flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" /> <span>Mensagens Rápidas</span>
            </TabsTrigger>
            <TabsTrigger value="users_teams" activeValue={activeTab} onClick={() => setActiveTab('users_teams')} className="inline-flex items-center space-x-2">
              <Users className="h-4 w-4" /> <span>Usuários e Equipes</span>
            </TabsTrigger>
          </Tabs>
        </div>
        <CardContent className="p-0">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

const UsersAndTeamsManager = () => {
    const [activeSubTab, setActiveSubTab] = useState<'queues' | 'teams'>('queues');

    return (
        <div>
            <div className="border-b">
                <Tabs className="px-6">
                    <TabsTrigger value="queues" activeValue={activeSubTab} onClick={() => setActiveSubTab('queues')} className="flex items-center space-x-2">
                        <List className="h-4 w-4" /> <span>Filas de Atendimento</span>
                    </TabsTrigger>
                    <TabsTrigger value="teams" activeValue={activeSubTab} onClick={() => setActiveSubTab('teams')} className="flex items-center space-x-2">
                        <Users2 className="h-4 w-4" /> <span>Equipes</span>
                    </TabsTrigger>
                </Tabs>
            </div>
            {activeSubTab === 'queues' && <QueueManager />}
            {activeSubTab === 'teams' && <TeamManager />}
        </div>
    )
}

export default Registrations;
