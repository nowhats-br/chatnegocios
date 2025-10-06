import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Label from '../ui/Label';
import Button from '../ui/Button';
import Textarea from '../ui/Textarea';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const productSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  price: z.coerce.number().positive("O preço deve ser um número positivo."),
  stock: z.coerce.number().int().nonnegative("O estoque deve ser um número inteiro não negativo."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: (product: Product) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ isOpen, onClose, product, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description || '',
        image_url: product.image_url || '',
      });
    } else {
      reset({
        name: '',
        price: 0,
        stock: 0,
        description: '',
        image_url: '',
      });
    }
  }, [product, reset, isOpen]);

  const onSubmit = async (data: ProductFormData) => {
    if (!user) {
      toast.error("Sessão inválida. Por favor, faça login novamente.");
      return;
    }
    setIsSubmitting(true);
    try {
      let result;
      const productData = { 
        ...data, 
        image_url: data.image_url || null,
        user_id: user.id 
      };

      if (product) {
        // Update
        result = await supabase.from('products').update(productData).eq('id', product.id).select().single();
      } else {
        // Create
        result = await supabase.from('products').insert(productData).select().single();
      }

      if (result.error) throw result.error;
      
      toast.success(`Produto ${product ? 'atualizado' : 'criado'} com sucesso!`);
      onSuccess(result.data);
      onClose();

    } catch (error: any) {
      toast.error(`Erro ao ${product ? 'atualizar' : 'criar'} produto`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Editar Produto' : 'Novo Produto'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome do Produto</Label>
          <Input id="name" {...register('name')} className="mt-1" />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Preço (R$)</Label>
            <Input id="price" type="number" step="0.01" {...register('price')} className="mt-1" />
            {errors.price && <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>}
          </div>
          <div>
            <Label htmlFor="stock">Estoque</Label>
            <Input id="stock" type="number" {...register('stock')} className="mt-1" />
            {errors.stock && <p className="text-sm text-red-500 mt-1">{errors.stock.message}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="description">Descrição (Opcional)</Label>
          <Textarea id="description" {...register('description')} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="image_url">URL da Imagem (Opcional)</Label>
          <Input id="image_url" {...register('image_url')} className="mt-1" placeholder="https://..." />
          {errors.image_url && <p className="text-sm text-red-500 mt-1">{errors.image_url.message}</p>}
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductForm;
