import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { BotMessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'signIn' | 'signUp';

const Login: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signIn') {
        const { token, user } = await dbClient.auth.login(email, password);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
      } else {
        const { token, user } = await dbClient.auth.register(email, password);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        toast.success('Cadastro realizado!', {
          description: 'Sua conta foi criada com sucesso.',
        });
        navigate('/');
      }
      
      if (mode === 'signIn') {
        navigate('/');
      }

    } catch (error: any) {
      toast.error('Ocorreu um erro', {
        description: error.message || 'Não foi possível completar a operação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg">
        <div className="text-center">
            <BotMessageSquare className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              {mode === 'signIn' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {mode === 'signIn' ? 'Faça login para acessar o EvoChat.' : 'Comece a gerenciar seus atendimentos.'}
            </p>
        </div>
        <form className="space-y-6" onSubmit={handleAuth}>
          <div>
            <label htmlFor="email" className="text-sm font-medium">E-mail</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password">Senha</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signIn' ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signIn' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <Button variant="link" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            {mode === 'signIn' ? 'Cadastre-se' : 'Faça login'}
          </Button>
        </p>
      </div>
    </div>
  );
};

export default Login;
