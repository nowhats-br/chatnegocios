import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  BotMessageSquare,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conexoes', icon: PlugZap, label: 'Conexões' },
  { to: '/chat', icon: MessageSquare, label: 'Atendimento' },
  { to: '/kanban', icon: KanbanSquare, label: 'Kanban' },
  { to: '/cadastros', icon: Users, label: 'Cadastros' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      animate={{ width: isCollapsed ? 80 : 250 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-card border-r text-foreground"
    >
      <div className="flex items-center justify-center p-4 h-[65px] border-b">
        <BotMessageSquare className="text-primary h-8 w-8" />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="font-bold text-xl ml-2"
            >
              EvoChat
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
              `flex items-center p-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 font-medium"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

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
