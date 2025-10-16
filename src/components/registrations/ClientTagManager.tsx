import React, { useState, useEffect } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Contact, Tag } from '@/types/database';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  client: Contact;
  onSuccess: () => void;
}

const ClientTagManager: React.FC<ClientTagManagerProps> = ({ isOpen, onClose, client, onSuccess }) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [clientTagIds, setClientTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const allTagsData = await dbClient.tags.list();
        setAllTags(allTagsData);
      } catch (error: any) {
        toast.error("Erro ao buscar etiquetas disponíveis.", { description: error.message });
      }

      const initialTagIds = new Set(client.contact_tags.map(ct => ct.tags.id));
      setClientTagIds(initialTagIds);

      setLoading(false);
    };

    fetchInitialData();
  }, [isOpen, client]);

  const handleTagClick = (tagId: string) => {
    setClientTagIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await dbClient.contacts.updateTags(client.id, Array.from(clientTagIds));
      toast.success("Etiquetas atualizadas com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Erro ao atualizar etiquetas.", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gerenciar Etiquetas de ${client.name || 'Cliente'}`}>
      <div className="space-y-4 min-h-[200px]">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">Selecione as etiquetas para este cliente.</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.id)}
                  className={cn(
                    "px-3 py-1 text-sm rounded-full transition-all duration-200",
                    clientTagIds.has(tag.id) ? 'ring-2 ring-offset-2 ring-offset-background ring-[var(--tag-color)]' : 'opacity-60 hover:opacity-100'
                  )}
                  style={{ 
                    backgroundColor: tag.color || '#cccccc',
                    color: '#ffffff',
                    '--tag-color': tag.color || '#cccccc'
                  } as React.CSSProperties}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" onClick={handleSave} disabled={isSubmitting || loading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ClientTagManager;
