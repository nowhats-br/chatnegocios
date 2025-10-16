import React, { useState, useEffect, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Tag } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, PlusCircle, MoreHorizontal, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import AlertDialog from '../ui/AlertDialog';
import TagForm from './TagForm';

const TagManager: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.tags.list();
      setTags(data);
    } catch (error: any) {
      toast.error('Erro ao buscar etiquetas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setFormOpen(true);
  };
  
  const handleDelete = (tag: Tag) => {
    setSelectedTag(tag);
    setAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTag) return;
    setIsSubmitting(true);
    try {
      await dbClient.tags.delete(selectedTag.id);
      toast.success('Etiqueta excluída com sucesso!');
      setTags(tags.filter(p => p.id !== selectedTag.id));
      setAlertOpen(false);
      setSelectedTag(null);
    } catch (error: any) {
      toast.error('Erro ao excluir etiqueta', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFormSuccess = (newTag: Tag) => {
    if (selectedTag) {
      setTags(tags.map(p => p.id === newTag.id ? newTag : p));
    } else {
      setTags([newTag, ...tags]);
    }
    setFormOpen(false);
    setSelectedTag(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Gerenciar Etiquetas</h2>
        <Button onClick={() => { setSelectedTag(null); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nova Etiqueta
        </Button>
      </div>

      <div className="border rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : tags.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma etiqueta cadastrada</h3>
            <p className="mt-1 text-sm text-muted-foreground">Crie etiquetas para organizar seus contatos e conversas.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="w-[50px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: tag.color || '#cccccc' }} />
                      <span>{tag.color}</span>
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
                        <DropdownMenuItem onClick={() => handleEdit(tag)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(tag)} className="text-red-500 hover:!text-red-500">
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
      
      <TagForm 
        isOpen={isFormOpen} 
        onClose={() => { setFormOpen(false); setSelectedTag(null); }}
        tag={selectedTag}
        onSuccess={onFormSuccess}
      />

      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDelete}
        title="Tem certeza que deseja excluir?"
        description="Esta ação não pode ser desfeita. A etiqueta será removida permanentemente."
        confirmText="Excluir"
        isConfirming={isSubmitting}
      />
    </div>
  );
};

export default TagManager;
