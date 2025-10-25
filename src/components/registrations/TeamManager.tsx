import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Team } from '@/types/database';
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

const TeamManager: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Partial<Team> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('teams').select('*').order('name', { ascending: true });
    if (error) toast.error('Erro ao buscar equipes', { description: error.message });
    else setTeams(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleSave = async () => {
    if (!user || !selectedTeam?.name) {
      toast.warning("O nome da equipe é obrigatório.");
      return;
    }
    setIsSubmitting(true);
    const teamData = {
      name: selectedTeam.name,
      description: selectedTeam.description,
      user_id: user.id
    };

    try {
      let result;
      if (selectedTeam.id) {
        result = await supabase.from('teams').update(teamData).eq('id', selectedTeam.id).select().single();
      } else {
        result = await supabase.from('teams').insert(teamData).select().single();
      }
      if (result.error) throw result.error;
      toast.success(`Equipe ${selectedTeam.id ? 'atualizada' : 'criada'} com sucesso!`);
      fetchTeams();
      setFormOpen(false);
    } catch (error: any) {
      toast.error(`Erro ao salvar equipe`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedTeam?.id) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('teams').delete().eq('id', selectedTeam.id);
    if (error) toast.error('Erro ao excluir equipe', { description: error.message });
    else {
      toast.success('Equipe excluída com sucesso!');
      fetchTeams();
      setAlertOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="typography-h3">Equipes de Atendimento</h2>
        <Button onClick={() => { setSelectedTeam({ name: '', description: '' }); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nova Equipe
        </Button>
      </div>
      <div className="border rounded-lg">
        {loading ? <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        : teams.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 typography-h4">Nenhuma equipe cadastrada</h3>
            <p className="mt-2 typography-body typography-muted">Crie equipes para organizar seus usuários.</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead className="w-[50px]">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.description}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedTeam(team); setFormOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedTeam(team); setAlertOpen(true); }} className="text-red-500 hover:!text-red-500"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={selectedTeam?.id ? 'Editar Equipe' : 'Nova Equipe'}>
        <div className="space-y-4">
          <div><Label htmlFor="name">Nome da Equipe</Label><Input id="name" value={selectedTeam?.name || ''} onChange={e => setSelectedTeam(p => ({...p, name: e.target.value}))} className="mt-1" /></div>
          <div><Label htmlFor="description">Descrição</Label><Textarea id="description" value={selectedTeam?.description || ''} onChange={e => setSelectedTeam(p => ({...p, description: e.target.value}))} className="mt-1" /></div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" onClick={handleSave} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedTeam?.id ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>

      <AlertDialog isOpen={isAlertOpen} onClose={() => setAlertOpen(false)} onConfirm={confirmDelete} title="Tem certeza?" description="Esta ação não pode ser desfeita. A equipe será removida permanentemente." confirmText="Excluir" isConfirming={isSubmitting} />
    </div>
  );
};

export default TeamManager;
