import React, { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Loader2, Command } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { dbClient } from '@/lib/dbClient';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

type AuthMode = 'signIn' | 'signUp';

const Login: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate('/');
    return null;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signIn') {
        await dbClient.auth.login(email, password);
        navigate('/');
      } else {
        await dbClient.auth.register(email, password);
        toast.success('Cadastro realizado!', {
          description: 'Sua conta foi criada. Verifique seu e-mail para confirmar e depois faça login.',
        });
        setMode('signIn');
        setPassword('');
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
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-grid-small-white/[0.2] bg-grid-small-black/[0.2]">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 space-y-8 glassmorphism rounded-xl shadow-2xl"
      >
        <div className="text-center">
          <Command className="mx-auto h-12 w-12 text-primary" />
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="typography-h1 mt-4">
                {mode === 'signIn' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
              </h1>
              <p className="typography-body typography-muted mt-2">
                {mode === 'signIn' ? 'Faça login para acessar o Chatvendas.' : 'Comece a gerenciar seus atendimentos.'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        <form className="space-y-6" onSubmit={handleAuth}>
          <div>
            <label htmlFor="email" className="typography-body-sm font-semibold text-foreground">E-mail</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="mt-1 bg-secondary/50 border-border/50"
            />
          </div>
          <div>
            <label htmlFor="password" className="typography-body-sm font-semibold text-foreground">Senha</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1 bg-secondary/50 border-border/50"
            />
          </div>
          <Button type="submit" className="w-full !mt-8" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signIn' ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>
        <p className="typography-body-sm typography-muted text-center">
          {mode === 'signIn' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <Button variant="link" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            {mode === 'signIn' ? 'Cadastre-se' : 'Faça login'}
          </Button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
