import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Queue } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, PlusCircle, MoreHorizontal, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import AlertDialog from '../ui/AlertDialog';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Label from '../ui/Label';
import Textarea from '../ui/Textarea';

const QueueManager: React.FC = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<Partial<Queue> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('queues').select('*').order('name', { ascending: true });
    if (error) toast.error('Erro ao buscar filas', { description: error.message });
    else setQueues(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);

  const handleSave = async () => {
    if (!user || !selectedQueue?.name) {
      toast.warning("O nome da fila é obrigatório.");
      return;
    }
    setIsSubmitting(true);
    const queueData = {
      name: selectedQueue.name,
      description: selectedQueue.description,
      user_id: user.id
    };

    try {
      let result;
      if (selectedQueue.id) {
        result = await supabase.from('queues').update(queueData).eq('id', selectedQueue.id).select().single();
      } else {
        result = await supabase.from('queues').insert(queueData).select().single();
      }
      if (result.error) throw result.error;
      toast.success(`Fila ${selectedQueue.id ? 'atualizada' : 'criada'} com sucesso!`);
      fetchQueues();
      setFormOpen(false);
    } catch (error: any) {
      toast.error(`Erro ao salvar fila`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedQueue?.id) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('queues').delete().eq('id', selectedQueue.id);
    if (error) toast.error('Erro ao excluir fila', { description: error.message });
    else {
      toast.success('Fila excluída com sucesso!');
      fetchQueues();
      setAlertOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="typography-h3">Filas de Atendimento</h2>
        <Button onClick={() => { setSelectedQueue({ name: '', description: '' }); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nova Fila
        </Button>
      </div>
      <div className="border rounded-lg">
        {loading ? <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        : queues.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 typography-h4">Nenhuma fila cadastrada</h3>
            <p className="mt-2 typography-body typography-muted">Crie filas para organizar seus atendimentos.</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead className="w-[50px]">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue.id}>
                  <TableCell className="font-medium">{queue.name}</TableCell>
                  <TableCell>{queue.description}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedQueue(queue); setFormOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedQueue(queue); setAlertOpen(true); }} className="text-red-500 hover:!text-red-500"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={selectedQueue?.id ? 'Editar Fila' : 'Nova Fila'}>
        <div className="space-y-4">
          <div><Label htmlFor="name">Nome da Fila</Label><Input id="name" value={selectedQueue?.name || ''} onChange={e => setSelectedQueue(p => ({...p, name: e.target.value}))} className="mt-1" /></div>
          <div><Label htmlFor="description">Descrição</Label><Textarea id="description" value={selectedQueue?.description || ''} onChange={e => setSelectedQueue(p => ({...p, description: e.target.value}))} className="mt-1" /></div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" onClick={handleSave} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedQueue?.id ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>

      <AlertDialog isOpen={isAlertOpen} onClose={() => setAlertOpen(false)} onConfirm={confirmDelete} title="Tem certeza?" description="Esta ação não pode ser desfeita. A fila será removida permanentemente." confirmText="Excluir" isConfirming={isSubmitting} />
    </div>
  );
};

export default QueueManager;
