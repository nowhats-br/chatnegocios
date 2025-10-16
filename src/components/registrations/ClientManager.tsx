import React, { useState, useEffect, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Contact } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, PlusCircle, MoreHorizontal, Pencil, Trash2, User, AlertTriangle, Tags } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import AlertDialog from '../ui/AlertDialog';
import ClientTagManager from './ClientTagManager';

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [isTagManagerOpen, setTagManagerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.contacts.listWithTags();
      setClients(data as any);
    } catch (error: any) {
      toast.error('Erro ao buscar clientes', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleEdit = (client: Contact) => {
    setSelectedClient(client);
    toast.info("Formulário de edição de cliente em breve!");
  };
  
  const handleDelete = (client: Contact) => {
    setSelectedClient(client);
    setAlertOpen(true);
  };

  const handleManageTags = (client: Contact) => {
    setSelectedClient(client);
    setTagManagerOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      await dbClient.contacts.delete(selectedClient.id);
      toast.success('Cliente excluído com sucesso!');
      setClients(clients.filter(p => p.id !== selectedClient.id));
      setAlertOpen(false);
      setSelectedClient(null);
    } catch (error: any) {
      toast.error('Erro ao excluir cliente', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Seus Clientes</h2>
        <Button onClick={() => toast.info("Novos clientes são criados automaticamente ao receberem a primeira mensagem.")}>
          <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="border rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum cliente encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">Os contatos que enviarem mensagens aparecerão aqui.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Etiquetas</TableHead>
                <TableHead className="w-[50px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium flex items-center">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mr-3">
                        {client.avatar_url ? <img src={client.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    {client.name || 'Desconhecido'}
                  </TableCell>
                  <TableCell>{client.phone_number}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {client.contact_tags?.map(({ tags }) => tags && (
                        <span key={tags.id} className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: tags.color || '#cccccc', color: '#ffffff' }}>
                          {tags.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleManageTags(client)}>
                          <Tags className="mr-2 h-4 w-4" /> Gerenciar Etiquetas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(client)} className="text-red-500 hover:!text-red-500">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
      {selectedClient && (
        <ClientTagManager
          isOpen={isTagManagerOpen}
          onClose={() => setTagManagerOpen(false)}
          client={selectedClient}
          onSuccess={fetchClients}
        />
      )}

      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDelete}
        title="Tem certeza que deseja excluir?"
        description="Esta ação não pode ser desfeita. O cliente e seu histórico de conversas serão removidos."
        confirmText="Excluir"
        isConfirming={isSubmitting}
      />
    </div>
  );
};

export default ClientManager;
