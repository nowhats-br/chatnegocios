import React from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '../providers/theme-provider';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <header className="flex items-center justify-between h-[65px] px-6 bg-card border-b">
      <div className="flex items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversas, contatos..."
            className="w-full md:w-80 pl-10 pr-4 py-2 rounded-lg bg-secondary border border-transparent focus:bg-background focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-accent">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button className="relative p-2 rounded-full hover:bg-accent">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500" />
        </button>
        <Button variant="outline" size="sm" onClick={handleLogout}>Sair</Button>
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
          {userInitial}
        </div>
      </div>
    </header>
  );
};

export default Header;
