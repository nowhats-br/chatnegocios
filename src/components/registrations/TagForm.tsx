import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { dbClient } from '@/lib/dbClient';
import { Tag } from '@/types/database';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Label from '../ui/Label';
import Button from '../ui/Button';
import { Loader2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { useAuth } from '@/contexts/AuthContext';

const tagSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagFormProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
  onSuccess: (tag: Tag) => void;
}

const TagForm: React.FC<TagFormProps> = ({ isOpen, onClose, tag, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: '',
      color: '#25D366'
    }
  });

  useEffect(() => {
    if (isOpen) {
        if (tag) {
          reset({
            name: tag.name,
            color: tag.color || '#25D366',
          });
        } else {
          reset({
            name: '',
            color: '#25D366',
          });
        }
    }
  }, [tag, reset, isOpen]);

  const onSubmit = async (data: TagFormData) => {
    if (!user) {
      toast.error("Sessão inválida. Por favor, faça login novamente.");
      return;
    }
    setIsSubmitting(true);
    try {
      const tagPayload = { ...data, user_id: user.id };
      let savedTag: Tag;
      if (tag) {
        savedTag = await dbClient.tags.update(tag.id, { name: tagPayload.name, color: tagPayload.color });
      } else {
        savedTag = await dbClient.tags.create(tagPayload);
      }
      toast.success(`Etiqueta ${tag ? 'atualizada' : 'criada'} com sucesso!`);
      onSuccess(savedTag);
      onClose();
    } catch (error: any) {
      toast.error(`Erro ao ${tag ? 'atualizar' : 'criar'} etiqueta`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tag ? 'Editar Etiqueta' : 'Nova Etiqueta'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome da Etiqueta</Label>
          <Input id="name" {...register('name')} className="mt-1" />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        
        <div>
          <Label>Cor</Label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <div className="mt-2 flex flex-col items-center">
                <HexColorPicker color={field.value} onChange={field.onChange} />
                <Input value={field.value} onChange={field.onChange} className="mt-4 w-32 text-center" />
              </div>
            )}
          />
          {errors.color && <p className="text-sm text-red-500 mt-1 text-center">{errors.color.message}</p>}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tag ? 'Salvar Alterações' : 'Criar Etiqueta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TagForm;
