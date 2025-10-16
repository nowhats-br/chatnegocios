import React, { useState, useEffect, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { QuickResponse } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, PlusCircle, MoreHorizontal, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import AlertDialog from '../ui/AlertDialog';
import QuickResponseForm from './QuickResponseForm';

const QuickResponseManager: React.FC = () => {
  const [responses, setResponses] = useState<QuickResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<QuickResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.quickResponses.list();
      setResponses((data as QuickResponse[]).sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
    } catch (error: any) {
      toast.error('Erro ao buscar mensagens rápidas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const handleEdit = (response: QuickResponse) => {
    setSelectedResponse(response);
    setFormOpen(true);
  };
  
  const handleDelete = (response: QuickResponse) => {
    setSelectedResponse(response);
    setAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedResponse) return;
    setIsSubmitting(true);
    try {
      await dbClient.quickResponses.delete(selectedResponse.id);
      toast.success('Mensagem rápida excluída com sucesso!');
      setResponses(responses.filter(r => r.id !== selectedResponse.id));
      setAlertOpen(false);
      setSelectedResponse(null);
    } catch (error: any) {
      toast.error('Erro ao excluir mensagem', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFormSuccess = (newResponse: QuickResponse) => {
    if (selectedResponse) {
      setResponses(responses.map(r => r.id === newResponse.id ? newResponse : r));
    } else {
      setResponses([...responses, newResponse].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
    }
    setFormOpen(false);
    setSelectedResponse(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Mensagens Rápidas</h2>
        <Button onClick={() => { setSelectedResponse(null); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nova Mensagem
        </Button>
      </div>

      <div className="border rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : responses.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma mensagem rápida</h3>
            <p className="mt-1 text-sm text-muted-foreground">Crie atalhos para agilizar seu atendimento.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Atalho</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[50px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((response) => (
                <TableRow key={response.id}>
                  <TableCell className="font-mono font-medium bg-secondary/50 rounded-md">/{response.shortcut}</TableCell>
                  <TableCell className="truncate max-w-sm">{response.message}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(response)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(response)} className="text-red-500 hover:!text-red-500">
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
      
      <QuickResponseForm 
        isOpen={isFormOpen} 
        onClose={() => { setFormOpen(false); setSelectedResponse(null); }}
        quickResponse={selectedResponse}
        onSuccess={onFormSuccess}
      />

      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDelete}
        title="Tem certeza que deseja excluir?"
        description="Esta ação não pode ser desfeita. A mensagem rápida será removida permanentemente."
        confirmText="Excluir"
        isConfirming={isSubmitting}
      />
    </div>
  );
};

export default QuickResponseManager;
