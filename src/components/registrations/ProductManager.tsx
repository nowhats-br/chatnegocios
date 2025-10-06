import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, PlusCircle, MoreHorizontal, Pencil, Trash2, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import ProductForm from './ProductForm';
import AlertDialog from '../ui/AlertDialog';

const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao buscar produtos', { description: error.message });
    } else {
      setProducts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormOpen(true);
  };
  
  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);
    if (error) {
      toast.error('Erro ao excluir produto', { description: error.message });
    } else {
      toast.success('Produto excluído com sucesso!');
      setProducts(products.filter(p => p.id !== selectedProduct.id));
      setAlertOpen(false);
      setSelectedProduct(null);
    }
    setIsSubmitting(false);
  };

  const onFormSuccess = (newProduct: Product) => {
    if (selectedProduct) {
      setProducts(products.map(p => p.id === newProduct.id ? newProduct : p));
    } else {
      setProducts([newProduct, ...products]);
    }
    setFormOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Seu Catálogo de Produtos</h2>
        <Button onClick={() => { setSelectedProduct(null); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <div className="border rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center h-60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum produto cadastrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comece adicionando seu primeiro item ao catálogo.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead className="w-[50px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-secondary flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(product)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(product)} className="text-red-500 hover:!text-red-500">
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
      
      <ProductForm 
        isOpen={isFormOpen} 
        onClose={() => { setFormOpen(false); setSelectedProduct(null); }}
        product={selectedProduct}
        onSuccess={onFormSuccess}
      />

      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDelete}
        title="Tem certeza que deseja excluir?"
        description="Esta ação não pode ser desfeita. O produto será removido permanentemente do seu catálogo."
        confirmText="Excluir"
        isConfirming={isSubmitting}
      />
    </div>
  );
};

export default ProductManager;
