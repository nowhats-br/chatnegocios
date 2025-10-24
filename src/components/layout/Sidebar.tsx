import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  PlugZap,
  KanbanSquare,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conexoes', icon: PlugZap, label: 'Conexões' },
  { to: '/chat', icon: MessageSquare, label: 'Atendimento' },
  { to: '/kanban', icon: KanbanSquare, label: 'Kanban' },
  { to: '/cadastros', icon: Users, label: 'Cadastros' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(location.pathname !== '/');

  useEffect(() => {
    // Collapse automatically only on non-dashboard pages; open on dashboard
    setIsCollapsed(location.pathname !== '/');
  }, [location.pathname]);

  return (
    <motion.div
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-card border-r text-foreground font-menu"
    >
      <div className="flex items-center justify-center p-4 h-[65px] border-b">
        <Command className="text-primary h-8 w-8" />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="font-bold text-xl ml-3 font-menu"
            >
              Chatvendas
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              cn(
                "flex items-center p-3 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground",
                isCollapsed && "justify-center"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 font-medium font-menu"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t space-y-2">
         <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              cn(
                "flex items-center p-3 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground",
                isCollapsed && "justify-center"
              )
            }
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 font-medium"
                >
                  Configurações
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-3 rounded-lg hover:bg-accent"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
