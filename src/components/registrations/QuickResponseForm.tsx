import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Migração Supabase -> Express: usar endpoints /api/quick-responses
import { QuickResponse } from '@/types/database';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Label from '../ui/Label';
import Button from '../ui/Button';
import Textarea from '../ui/Textarea';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const quickResponseSchema = z.object({
  shortcut: z.string().min(2, "O atalho deve ter pelo menos 2 caracteres.").regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e underscore.'),
  message: z.string().min(3, "A mensagem deve ter pelo menos 3 caracteres."),
});

type QuickResponseFormData = z.infer<typeof quickResponseSchema>;

interface QuickResponseFormProps {
  isOpen: boolean;
  onClose: () => void;
  quickResponse: QuickResponse | null;
  onSuccess: (response: QuickResponse) => void;
}

const QuickResponseForm: React.FC<QuickResponseFormProps> = ({ isOpen, onClose, quickResponse, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuickResponseFormData>({
    resolver: zodResolver(quickResponseSchema),
  });

  useEffect(() => {
    if (quickResponse) {
      reset(quickResponse);
    } else {
      reset({ shortcut: '', message: '' });
    }
  }, [quickResponse, reset, isOpen]);

  const onSubmit = async (data: QuickResponseFormData) => {
    if (!user) {
      toast.error("Sessão inválida. Por favor, faça login novamente.");
      return;
    }
    setIsSubmitting(true);
    try {
      const responseData = { ...data, user_id: user.id };
      let saved: QuickResponse | null = null;
      if (quickResponse) {
        const res = await fetch(`/api/quick-responses/${quickResponse.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responseData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          throw new Error(errData.message);
        }
        saved = await res.json();
      } else {
        const res = await fetch('/api/quick-responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responseData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          throw new Error(errData.message);
        }
        saved = await res.json();
      }

      toast.success(`Mensagem rápida ${quickResponse ? 'atualizada' : 'criada'} com sucesso!`);
      onSuccess(saved as QuickResponse);
      onClose();

    } catch (error: any) {
      toast.error(`Erro ao ${quickResponse ? 'atualizar' : 'criar'} mensagem`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={quickResponse ? 'Editar Mensagem Rápida' : 'Nova Mensagem Rápida'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="shortcut">Atalho</Label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 sm:text-sm">/</span>
            </div>
            <Input id="shortcut" {...register('shortcut')} className="pl-7" placeholder="ex: saudacao_inicial" />
          </div>
          {errors.shortcut && <p className="text-sm text-red-500 mt-1">{errors.shortcut.message}</p>}
        </div>
        <div>
          <Label htmlFor="message">Mensagem</Label>
          <Textarea id="message" {...register('message')} className="mt-1" rows={5} />
          {errors.message && <p className="text-sm text-red-500 mt-1">{errors.message.message}</p>}
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {quickResponse ? 'Salvar Alterações' : 'Criar Mensagem'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default QuickResponseForm;
